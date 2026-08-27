'use server'

import { createBilling } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { insertNode } from '@genny/db/repositories/canvas-nodes.ts'
import { attachFalRequest, createJob, failJob } from '@genny/db/repositories/jobs.ts'
import { findProject, touchProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { submitJob } from '@genny/fal/queue.ts'
import { falWebhookUrl } from '@genny/fal/webhook-url.ts'
import { creditsFor, estimateUnits } from '@genny/models/credits.ts'
import { type CanvasGenerationRequest, canvasGenerationRequest } from '@genny/models/request.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import type { GenerationResult } from '../schema.ts'
import { prepareGeneration } from './prepare.ts'

/**
 * Submits a generation and reserves its space on the board in the same call.
 *
 * The placeholder node is written before the submit for the same reason the job
 * row is: a generation whose space was never reserved lands wherever the layout
 * happens to have room by then, which is nowhere near where the person was
 * looking when they pressed the button.
 */
export async function createGeneration(raw: unknown): Promise<GenerationResult> {
  const parsed = canvasGenerationRequest.safeParse(raw)
  if (!parsed.success) return refuse('Those settings are not valid.', false)
  const request: CanvasGenerationRequest = parsed.data

  const actorId = await ensureActorId()
  const db = appDb(env().DATABASE_URL)

  // RLS scopes the read, so a project belonging to somebody else is simply not
  // found and needs no separate ownership check.
  const project = await withActor(db, actorId, (tx) => findProject(tx, request.projectId))
  if (!project) return refuse('That canvas is gone.', false)

  const prepared = await prepareGeneration({ request, actorId, db })
  if ('ok' in prepared) return prepared
  const { model, credentials, payload } = prepared

  const billing = createBilling(env().GENNY_MODE, db)
  const held = await billing.hold(actorId, String(quote(model, payload)))
  if (!held.ok) return refuse(held.reason, false)

  const { job, nodeId } = await withActor(db, actorId, async (tx) => {
    const job = await createJob(tx, {
      ownerId: actorId,
      endpointId: model.endpointId,
      prompt: { text: request.prompt, references: request.references },
      input: payload,
      creditsHeld: billing.tracksCredits ? held.held : undefined,
    })
    const node = await insertNode(tx, {
      projectId: request.projectId,
      ownerId: actorId,
      ...request.node,
      jobId: job.id,
    })
    await touchProject(tx, request.projectId)
    return { job, nodeId: node?.id ?? null }
  })

  try {
    const { requestId } = await submitJob(
      credentials,
      model.endpointId,
      payload,
      falWebhookUrl({ mode: env().GENNY_MODE, appUrl: env().APP_URL }),
    )
    await withActor(db, actorId, (tx) => attachFalRequest(tx, job.id, requestId))
    return {
      ok: true,
      jobId: job.id,
      nodeId,
      ...(prepared.dropped.length > 0 ? { dropped: prepared.dropped } : {}),
    }
  } catch (error) {
    const failure = error instanceof FalFailure ? error : null
    const message = failure?.userMessage ?? 'The generation could not be started.'
    // Nothing ran, so nothing is owed. The node stays and shows the failure:
    // deleting it would make the board silently forget the attempt.
    await billing.release(actorId, held.held)
    await withActor(db, actorId, (tx) => failJob(tx, job.id, message))
    return refuse(message, failure?.retryable ?? true)
  }
}

function quote(model: ModelDefinition, payload: Record<string, unknown>): number {
  return creditsFor(model, { units: estimateUnits(model, payload) }, env().CREDIT_PER_USD)
}

function refuse(reason: string, retryable: boolean): GenerationResult {
  return { ok: false, reason, retryable }
}
