import type { Database } from '@genny/db/client.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { findActor } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { applyAttachments } from '@genny/models/attachments.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { buildInputSchema } from '@genny/models/input.ts'
import { missingRequiredReferences, resolvePrompt } from '@genny/models/references.ts'
import type { CanvasGenerationRequest } from '@genny/models/request.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import { allSlots, unusableKinds } from '@genny/models/slots.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { generationRule, tierOf } from '@genny/ratelimit/rules.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import type { GenerationResult } from '../schema.ts'
import { resolveAttachments, resolveReferences } from './resolve-references.ts'

export type Prepared = {
  model: ModelDefinition
  credentials: NonNullable<Awaited<ReturnType<typeof readCredentials>>>
  payload: Record<string, unknown>
  dropped: string[]
}

/**
 * Everything that can refuse the request, in the order that costs least.
 *
 * Kept apart from the submit so each stays readable: this one decides whether the
 * generation may happen, and the action is what happens when it may.
 */
export async function prepareGeneration(context: {
  request: CanvasGenerationRequest
  actorId: string
  db: Database
}): Promise<Prepared | GenerationResult> {
  const { request, actorId, db } = context

  const entry = (await loadCatalog()).find((item) => item.definition.endpointId === request.modelId)
  if (!entry) return refuse('That model is not available.', false)
  const model = entry.definition

  // What they pay for decides the ceiling. Read with the elevated connection
  // because users grants the app role its own row and nothing else.
  const actor = await findActor(
    ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL),
    actorId,
  )
  const verdict = await createPostgresLimiter(db).check(
    generationRule(actor ? tierOf(actor) : 'anonymous', actorId),
  )
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
  const [references, attachments] = await Promise.all([
    resolveReferences(db, actorId, credentials, request.references),
    resolveAttachments(db, actorId, credentials, request.attachments),
  ])

  // Editing models refuse to run without an image and answer 422, which is
  // invisible from our side. Say it before spending the round trip.
  if (attachments.length === 0 && missingRequiredReferences(model, references).length > 0) {
    return refuse(`${model.displayName} needs an image. Attach one or mention it with @.`, false)
  }

  /*
   * Given something the model has no slot for at all. This used to run anyway:
   * the reference was dropped, a picture came back that ignored it, and the
   * warning arrived after the money. Refusing is the only honest answer, and it
   * has to happen before the hold.
   *
   * Partial drops stay a warning further down. Four of five taken is what was
   * asked for, mostly; none of five taken is a different generation.
   */
  const offered = request.references.length + request.attachments.length
  if (offered > 0 && unusableKinds(allSlots(model), ['image']).length > 0) {
    return refuse(
      `${model.displayName} makes images from text alone and cannot take a reference. Pick a model that edits.`,
      false,
    )
  }

  const resolved = resolvePrompt(model, request.prompt, references)
  // After the prompt and allowed to overwrite it: someone who pinned an asset to
  // the end frame said something the prompt has no way of saying.
  const pinned = applyAttachments(model, attachments)

  const payload = buildInputSchema(model).safeParse({
    ...request.settings,
    // Text to speech calls it `text`; every model names its own field, and an
    // upscaler names none. The schema is strict, so injecting a prompt into a
    // model that has no prompt field would refuse the generation outright.
    ...(model.promptField ? { [model.promptField]: resolved.text } : {}),
    ...resolved.patch,
    ...pinned.patch,
  })
  if (!payload.success) return refuse('The model rejected these settings.', false)

  return {
    model,
    credentials,
    payload: payload.data,
    dropped: [
      ...new Set([...resolved.dropped.map((reference) => reference.label), ...pinned.dropped]),
    ],
  }
}

function refuse(reason: string, retryable: boolean): GenerationResult {
  return { ok: false, reason, retryable }
}
