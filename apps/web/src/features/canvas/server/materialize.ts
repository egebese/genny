import { findAssetsByJob } from '@genny/assets/repository.ts'
import { siblingPosition } from '@genny/canvas/placement.ts'
import type { Database } from '@genny/db/client.ts'
import {
  fillNode,
  insertNode,
  listNodes,
  unfilledNodes,
} from '@genny/db/repositories/canvas-nodes.ts'

type Context = { projectId: string; ownerId: string }

/**
 * Puts a finished job's outputs on the board.
 *
 * Idempotent on purpose, and called from three places for the same reason: the
 * browser learns a job finished from its stream, a tab that was closed learns it
 * on the next load, and fal's webhook may have settled the job while neither was
 * watching. Whoever gets here first does the work; the rest are no-ops, enforced
 * by `(job_id, output_index)` and by the `asset_id is null` guard on the fill.
 */
export async function materializeJob(
  tx: Database,
  context: Context & { jobId: string },
): Promise<void> {
  const outputs = await findAssetsByJob(tx, context.jobId)
  if (outputs.length === 0) return

  const placed = (await listNodes(tx, context.projectId)).filter(
    (node) => node.jobId === context.jobId,
  )
  const anchor = placed.find((node) => node.outputIndex === 0)
  if (!anchor) return

  for (const [index, asset] of outputs.entries()) {
    const existing = placed.find((node) => node.outputIndex === index)
    if (existing) {
      if (!existing.assetId) await fillNode(tx, existing.id, asset.id)
      continue
    }
    /*
     * A sibling of the same request, so it goes in the row rather than into the
     * first gap the layout can find. Same size as the anchor: one generation
     * cannot return two different shapes.
     */
    await insertNode(tx, {
      projectId: context.projectId,
      ownerId: context.ownerId,
      ...siblingPosition(anchor, index),
      width: anchor.width,
      height: anchor.height,
      jobId: context.jobId,
      outputIndex: index,
      assetId: asset.id,
    })
  }
}

/** Catches up every node whose generation finished while nobody was looking. */
export async function materializePending(tx: Database, context: Context): Promise<void> {
  for (const node of await unfilledNodes(tx, context.projectId)) {
    await materializeJob(tx, { ...context, jobId: node.jobId })
  }
}
