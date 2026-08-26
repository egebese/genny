'use server'

import { createBilling } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { findActor } from '@genny/db/repositories/actors.ts'
import { attachFalRequest, createJob, failJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { submitJob } from '@genny/fal/queue.ts'
import { falWebhookUrl } from '@genny/fal/webhook-url.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { creditsFor, estimateUnits } from '@genny/models/credits.ts'
import { buildInputSchema } from '@genny/models/input.ts'
import { missingRequiredReferences, resolvePrompt } from '@genny/models/references.ts'
import { type GenerationRequest, generationRequest } from '@genny/models/request.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { generationRule, tierOf } from '@genny/ratelimit/rules.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import type { GenerationResult } from '../schema.ts'
import { resolveReferences } from './resolve-references.ts'

type Prepared = {
  model: ModelDefinition
  actorId: string
  db: ReturnType<typeof appDb>
  credentials: Awaited<ReturnType<typeof readCredentials>>
  request: GenerationRequest
  payload: Record<string, unknown>
  dropped: string[]
}

/**
 * Everything that can refuse the request, in the order that costs least.
 *
 * Kept apart from the submit so each stays readable: this one decides whether the
 * generation may happen, and `createGeneration` is what happens when it may.
 */
async function prepare(raw: unknown): Promise<Prepared | GenerationResult> {
  const parsed = generationRequest.safeParse(raw)
  if (!parsed.success) return refuse('Those settings are not valid.', false)
  const request = parsed.data

  const entry = (await loadCatalog()).find((item) => item.definition.endpointId === request.modelId)
  if (entry?.definition.modality !== 'image') return refuse('That model is not available.', false)
  const model = entry.definition

  const actorId = await ensureActorId()
  const db = appDb(env().DATABASE_URL)

  // What they pay for decides the ceiling. Read with the elevated connection
  // because users grants the app role its own row and nothing else.
  const actor = await findActor(
    ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL),
    actorId,
  )
  const tier = actor ? tierOf(actor) : 'anonymous'

  const verdict = await createPostgresLimiter(db).check(generationRule(tier, actorId))
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil((verdict.resetAt.getTime() - Date.now()) / 60_000))
    return refuse(`Too many generations for now. Try again in about ${minutes} minutes.`, true)
  }

  const credentials = await readCredentials().catch(() => null)
  if (!credentials) return refuse('Add a fal key before generating.', false)

  /*
   * References resolve to urls before validation, so the model schema sees the
   * payload that will actually be sent.
   *
   * The lookup goes through withActor, so RLS decides what this actor may
   * reference. An id belonging to somebody else simply is not found, which is
   * also why the ids arriving from the client need no ownership check here.
   */
  const references = await resolveReferences(db, actorId, credentials, request.references)

  // Editing models refuse to run without an image and answer 422, which is
  // invisible from our side. Say it before spending the round trip.
  if (missingRequiredReferences(model, references).length > 0) {
    return refuse(`${model.displayName} needs an image. Mention one with @.`, false)
  }

  const resolved = resolvePrompt(model, request.prompt, references)
  const payload = buildInputSchema(model).safeParse({
    ...request.settings,
    prompt: resolved.text,
    ...resolved.patch,
  })
  if (!payload.success) return refuse('The model rejected these settings.', false)

  return {
    model,
    actorId,
    db,
    credentials,
    request,
    payload: payload.data,
    dropped: [...new Set(resolved.dropped.map((reference) => reference.label))],
  }
}

export async function createGeneration(raw: unknown): Promise<GenerationResult> {
  const prepared = await prepare(raw)
  if ('ok' in prepared) return prepared
  const { model, actorId, db, credentials, request, payload } = prepared

  /*
   * Hold before submitting, so two tabs cannot spend the same credits. In byok
   * mode this is a no-op: the visitor is spending their own fal balance.
   */
  const billing = createBilling(env().GENNY_MODE, db)
  const estimate = creditsFor(model, { units: estimateUnits(model, payload) }, env().CREDIT_PER_USD)
  const held = await billing.hold(actorId, String(estimate))
  if (!held.ok) return refuse(held.reason, false)

  // The row exists before the submit: if the submit succeeds and the insert then
  // fails, we have paid for a generation nobody can see.
  const job = await withActor(db, actorId, (tx) =>
    createJob(tx, {
      ownerId: actorId,
      endpointId: model.endpointId,
      prompt: { text: request.prompt, references: request.references },
      input: payload,
      creditsHeld: billing.tracksCredits ? held.held : undefined,
    }),
  )

  try {
    const { requestId } = await submitJob(
      credentials,
      model.endpointId,
      payload,
      // Undefined unless this deployment is somewhere fal can call back to, in
      // which case the result lands even if the browser goes away.
      falWebhookUrl({ mode: env().GENNY_MODE, appUrl: env().APP_URL }),
    )
    await withActor(db, actorId, (tx) => attachFalRequest(tx, job.id, requestId))
    return prepared.dropped.length > 0
      ? { ok: true, jobId: job.id, dropped: prepared.dropped }
      : { ok: true, jobId: job.id }
  } catch (error) {
    const failure = error instanceof FalFailure ? error : null
    const message = failure?.userMessage ?? 'The generation could not be started.'
    // Nothing ran, so nothing is owed.
    await billing.release(actorId, held.held)
    await withActor(db, actorId, (tx) => failJob(tx, job.id, message))
    return refuse(message, failure?.retryable ?? true)
  }
}

function refuse(reason: string, retryable: boolean): GenerationResult {
  return { ok: false, reason, retryable }
}
