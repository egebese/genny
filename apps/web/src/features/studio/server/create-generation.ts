'use server'

import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { attachFalRequest, createJob, failJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { submitJob } from '@genny/fal/queue.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { buildInputSchema } from '@genny/models/input.ts'
import { resolvePrompt } from '@genny/models/references.ts'
import { generationRequest } from '@genny/models/request.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import type { GenerationResult } from '../schema.ts'

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

  // References resolve to urls before validation, so the model schema sees the
  // payload that will actually be sent.
  const resolved = resolvePrompt(model, request.prompt, [])
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
    return { ok: true, jobId: job.id }
  } catch (error) {
    const failure = error instanceof FalFailure ? error : null
    const message = failure?.userMessage ?? 'The generation could not be started.'
    await withActor(db, actorId, (tx) => failJob(tx, job.id, message))
    return refuse(message, failure?.retryable ?? true)
  }
}

function refuse(reason: string, retryable: boolean): GenerationResult {
  return { ok: false, reason, retryable }
}
