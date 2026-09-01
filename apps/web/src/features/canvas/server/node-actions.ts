'use server'

import { findAssetsByIds } from '@genny/assets/repository.ts'
import { pasteNodesRequest, restoreNodesRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { insertNode, listNodes, type NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'
import { findCanvas, touchCanvas } from '@genny/db/repositories/canvases.ts'
import { env } from '@genny/env/env.ts'
import { ensureActorId } from '@/features/session/actor.ts'

/**
 * Puts copies of assets already owned onto a board.
 *
 * Only the reference travels, never the bytes: a paste is a second node
 * pointing at the same asset, so duplicating a clip forty times costs forty
 * rows and no storage.
 *
 * The assets are looked up first, under RLS, and anything that does not come
 * back is dropped. The composite key on `(asset_id, owner_id)` is what actually
 * stops a forged clipboard writing a row that names somebody else's asset; this
 * turns that into a quiet drop rather than a constraint violation the person
 * pasting would have to read.
 */
export async function pasteNodes(raw: unknown): Promise<NodeRecord[]> {
  const parsed = pasteNodesRequest.safeParse(raw)
  if (!parsed.success) return []
  const { canvasId, items } = parsed.data
  const actorId = await ensureActorId()
  return withActor(db(), actorId, async (tx) => {
    if (!(await findCanvas(tx, canvasId))) return []
    const owned = await findAssetsByIds(
      tx,
      items.map((item) => item.assetId),
    )
    const mine = new Set(owned.map((asset) => asset.id))
    for (const item of items) {
      if (mine.has(item.assetId)) await insertNode(tx, { canvasId, ownerId: actorId, ...item })
    }
    await touchCanvas(tx, canvasId)
    return listNodes(tx, canvasId)
  })
}

/**
 * Puts back nodes that were deleted, with the ids they had.
 *
 * Undo needs the id to survive, and `deleteNode` is a real delete while
 * `insertNode` mints a fresh uuid, so a restored node would come back as a
 * stranger: the selection, the open panel, the attachment strip and every later
 * entry in the history stack all name it by id.
 *
 * A client-chosen primary key is the one genuinely unusual thing here, and it
 * is safe for three reasons stacked together. The owner comes from the session
 * and never from the request. The canvas is checked under RLS. The assets go
 * through the same ownership filter a paste does, so the composite key cannot
 * be pointed at somebody else's picture. A key that collides is swallowed by
 * `onConflictDoNothing`, which is a silent no-op rather than an oracle for
 * whether some other id exists.
 */
export async function restoreNodes(raw: unknown): Promise<NodeRecord[]> {
  const parsed = restoreNodesRequest.safeParse(raw)
  if (!parsed.success) return []
  const { canvasId, nodes } = parsed.data
  const actorId = await ensureActorId()

  return withActor(db(), actorId, async (tx) => {
    if (!(await findCanvas(tx, canvasId))) return []
    const owned = await findAssetsByIds(
      tx,
      nodes.map((node) => node.assetId),
    )
    const mine = new Set(owned.map((asset) => asset.id))

    for (const node of nodes) {
      if (!mine.has(node.assetId)) continue
      const { nodeId, ...rect } = node
      await insertNode(tx, { id: nodeId, canvasId, ownerId: actorId, ...rect })
    }
    await touchCanvas(tx, canvasId)
    return listNodes(tx, canvasId)
  })
}

function db() {
  return appDb(env().DATABASE_URL)
}
