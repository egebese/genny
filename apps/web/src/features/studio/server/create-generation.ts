'use server'

import { findAssetsByIds } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { attachFalRequest, createJob, failJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { submitJob } from '@genny/fal/queue.ts'
import { uploadReference } from '@genny/fal/upload.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { buildInputSchema } from '@genny/models/input.ts'
import { type PromptReference, resolvePrompt } from '@genny/models/references.ts'
import { generationRequest } from '@genny/models/request.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import type { GenerationResult } from '../schema.ts'
import { storage } from './storage.ts'

export async function createGeneration(raw: unknown): Promise<GenerationResult> {
  const parsed = generationRequest.safeParse(raw)
  if (!parsed.success) return refuse('Those settings are not valid.', false)
  const request = parsed.data

  const entry = (await loadCatalog()).find((item) => item.definition.endpointId === request.modelId)
  if (entry?.definition.modality !== 'image') return refuse('That model is not available.', false)
  const model = entry.definition

  const actorId = await ensureActorId()
  const db = appDb(env().DATABASE_URL)

  const verdict = await createPostgresLimiter(db).check(ruleFor('anonymousGeneration', actorId))
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil((verdict.resetAt.getTime() - Date.now()) / 60_000))
    return refuse(`Too many generations for now. Try again in about ${minutes} minutes.`, true)
  }

  let credentials: Awaited<ReturnType<typeof readCredentials>>
  try {
    credentials = await readCredentials()
  } catch {
    return refuse('Add a fal key before generating.', false)
  }

  /*
   * References resolve to urls before validation, so the model schema sees the
   * payload that will actually be sent.
   *
   * The lookup goes through withActor, so RLS decides what this actor may
   * reference. An id belonging to somebody else simply is not found, which is
   * also why the ids arriving from the client need no ownership check here.
   */
  const references = await resolveReferences(db, actorId, credentials, request.references)
  const resolved = resolvePrompt(model, request.prompt, references)
  const payload = buildInputSchema(model).safeParse({
    ...request.settings,
    prompt: resolved.text,
    ...resolved.patch,
  })
  if (!payload.success) return refuse('The model rejected these settings.', false)

  // The row exists before the submit: if the submit succeeds and the insert then
  // fails, we have paid for a generation nobody can see.
  const job = await withActor(db, actorId, (tx) =>
    createJob(tx, {
      ownerId: actorId,
      endpointId: model.endpointId,
      prompt: { text: request.prompt, references: request.references },
      input: payload.data,
    }),
  )

  try {
    const { requestId } = await submitJob(credentials, model.endpointId, payload.data)
    await withActor(db, actorId, (tx) => attachFalRequest(tx, job.id, requestId))
    return resolved.dropped.length > 0
      ? { ok: true, jobId: job.id, dropped: resolved.dropped.map((r) => r.label) }
      : { ok: true, jobId: job.id }
  } catch (error) {
    const failure = error instanceof FalFailure ? error : null
    const message = failure?.userMessage ?? 'The generation could not be started.'
    await withActor(db, actorId, (tx) => failJob(tx, job.id, message))
    return refuse(message, failure?.retryable ?? true)
  }
}

/**
 * Turns the asset ids the client sent into urls a model can fetch, in the order
 * the client listed them. Anything the actor cannot see is skipped, so a guessed
 * id reveals nothing.
 *
 * The url has to be reachable *by fal*, which our own bucket often is not: in
 * development it is localhost, and in production it may be private. So each
 * reference is handed to fal and its url is used instead.
 */
async function resolveReferences(
  db: ReturnType<typeof appDb>,
  actorId: string,
  credentials: Awaited<ReturnType<typeof readCredentials>>,
  requested: { token: string; label: string; kind: 'asset' | 'character'; id: string }[],
): Promise<PromptReference[]> {
  const assetIds = requested.filter((item) => item.kind === 'asset').map((item) => item.id)
  if (assetIds.length === 0) return []

  const found = await withActor(db, actorId, (tx) => findAssetsByIds(tx, assetIds))
  const byId = new Map(found.map((asset) => [asset.id, asset]))
  const bucket = storage()

  const resolved: PromptReference[] = []
  for (const item of requested) {
    const asset = byId.get(item.id)
    if (!asset) continue
    const bytes = await bucket.get(asset.storageKey)
    resolved.push({
      token: item.token,
      label: asset.label,
      url: await uploadReference(credentials, bytes, asset.mime),
    })
  }
  return resolved
}

function refuse(reason: string, retryable: boolean): GenerationResult {
  return { ok: false, reason, retryable }
}
