'use server'

import { createBilling } from '@genny/billing/provider.ts'
import { materializeRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listNodes, type NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'
import { findCanvas } from '@genny/db/repositories/canvases.ts'
import { cancelJob, findJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { logger } from '@genny/env/log.ts'
import { cancelJob as cancelOnFal } from '@genny/fal/queue.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'

/**
 * Gives up on a generation that is still running.
 *
 * There was no way to do this at all. A video model can take two minutes, and
 * somebody who realised at second three that they had the wrong prompt could
 * only watch it finish and take the money with it.
 *
 * Order matters: tell fal first, then give the credits back, then mark the row.
 * fal is the only part that can still spend, so it is the part to stop first,
 * and a row marked canceled while fal keeps running is a generation nobody is
 * watching that will be charged for anyway.
 *
 * Returns the board, like the other node actions, so the caller does not have
 * to guess what changed.
 */
export async function cancelGeneration(raw: unknown): Promise<NodeRecord[]> {
  const parsed = materializeRequest.safeParse(raw)
  if (!parsed.success) return []
  const { canvasId, jobId } = parsed.data

  const actorId = await ensureActorId()
  const config = env()
  const db = appDb(config.DATABASE_URL)

  const job = await withActor(db, actorId, (tx) => findJob(tx, jobId))
  if (!job || job.status === 'completed' || job.status === 'failed') {
    return await board(db, actorId, canvasId)
  }

  if (job.falRequestId) {
    try {
      await cancelOnFal(await readCredentials(), job.endpointId, job.falRequestId)
    } catch (error) {
      // fal refuses to cancel anything it has already finished, which is the
      // race below and not a failure. Recorded, then carried on with: the row
      // and the hold still need settling either way.
      log.warn('fal would not cancel', {
        jobId,
        reason: error instanceof Error ? error.message : 'unknown error',
      })
    }
  }

  const held = job.creditsHeld ?? '0'
  if (Number(held) > 0) {
    await createBilling(config.GENNY_MODE, db).release(actorId, held)
  }

  // False means it settled while we were asking fal. Its outputs are already
  // ingested and its credits already captured, so the board is the truth and
  // nothing here should overwrite it.
  await withActor(db, actorId, (tx) => cancelJob(tx, jobId))

  return await board(db, actorId, canvasId)
}

async function board(
  db: ReturnType<typeof appDb>,
  actorId: string,
  canvasId: string,
): Promise<NodeRecord[]> {
  return withActor(db, actorId, async (tx) =>
    (await findCanvas(tx, canvasId)) ? listNodes(tx, canvasId) : [],
  )
}

const log = logger('jobs')
