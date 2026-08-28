'use server'

import { findAssetsByIds } from '@genny/assets/repository.ts'
import {
  canvasRef,
  createCanvasRequest,
  materializeRequest,
  moveNodeRequest,
  nodeRef,
  pasteNodesRequest,
  renameCanvasRequest,
  resizeNodeRequest,
  saveViewportRequest,
} from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import {
  deleteNode,
  insertNode,
  listNodes,
  moveNode,
  type NodeRecord,
  resizeNode,
} from '@genny/db/repositories/canvas-nodes.ts'
import {
  createCanvas,
  deleteCanvas,
  findCanvas,
  renameCanvas,
  saveViewport,
  touchCanvas,
} from '@genny/db/repositories/canvases.ts'
import { defaultProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
import { ensureActorId } from '@/features/session/actor.ts'
import { materializeJob } from './materialize.ts'

const db = () => appDb(env().DATABASE_URL)

/**
 * Every action below is scoped by RLS rather than by an ownership check: a
 * canvas belonging to somebody else is not found, and a node update matches no
 * row. The failure direction is the correct one, which is why the ids arriving
 * from the browser are validated for shape only.
 */
export async function newCanvas(raw: unknown): Promise<{ id: string } | null> {
  const parsed = createCanvasRequest.safeParse(raw)
  if (!parsed.success) return null
  const actorId = await ensureActorId()

  const canvas = await withActor(db(), actorId, async (tx) => {
    /*
     * Into the project they were last working in, unless they named one. Work
     * starts as a board and only later turns out to be a project, so asking
     * which project first is a question about a structure that does not exist
     * yet.
     */
    const project = parsed.data.projectId
      ? { id: parsed.data.projectId }
      : await defaultProject(tx, actorId)
    return await createCanvas(tx, {
      ownerId: actorId,
      projectId: project.id,
      title: parsed.data.title,
    })
  })

  revalidatePath('/c')
  return { id: canvas.id }
}

export async function retitleCanvas(raw: unknown): Promise<boolean> {
  const parsed = renameCanvasRequest.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  await withActor(db(), actorId, (tx) => renameCanvas(tx, parsed.data.canvasId, parsed.data.title))
  revalidatePath('/c')
  return true
}

export async function discardCanvas(raw: unknown): Promise<boolean> {
  const parsed = canvasRef.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  const gone = await withActor(db(), actorId, (tx) => deleteCanvas(tx, parsed.data.canvasId))
  revalidatePath('/c')
  return gone
}

/**
 * Panning writes constantly, so this deliberately stays the cheapest action
 * there is: one update, no revalidation, nothing else touched.
 */
export async function persistViewport(raw: unknown): Promise<void> {
  const parsed = saveViewportRequest.safeParse(raw)
  if (!parsed.success) return
  const { canvasId, ...viewport } = parsed.data
  const actorId = await ensureActorId()
  await withActor(db(), actorId, (tx) => saveViewport(tx, canvasId, viewport))
}

export async function repositionNode(raw: unknown): Promise<void> {
  const parsed = moveNodeRequest.safeParse(raw)
  if (!parsed.success) return
  const { canvasId, nodeId, ...position } = parsed.data
  const actorId = await ensureActorId()
  await withActor(db(), actorId, async (tx) => {
    await moveNode(tx, nodeId, position)
    await touchCanvas(tx, canvasId)
  })
}

export async function resizeNodeOnCanvas(raw: unknown): Promise<boolean> {
  const parsed = resizeNodeRequest.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  await withActor(db(), actorId, (tx) =>
    resizeNode(tx, parsed.data.nodeId, { width: parsed.data.width, height: parsed.data.height }),
  )
  return true
}

export async function removeNode(raw: unknown): Promise<boolean> {
  const parsed = nodeRef.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  return withActor(db(), actorId, async (tx) => {
    const gone = await deleteNode(tx, parsed.data.nodeId)
    if (gone) await touchCanvas(tx, parsed.data.canvasId)
    return gone
  })
}

/**
 * Puts copies of assets already owned onto a board.
 *
 * Only the reference travels, never the bytes: a paste is a second node
 * pointing at the same asset, so duplicating a clip forty times costs forty
 * rows and no storage.
 *
 * The assets are looked up first, under RLS, and anything that does not come
 * back is dropped. `canvas_nodes.asset_id` is not owner-scoped, so a forged
 * clipboard could otherwise write a row on this board naming somebody else's
 * asset. Nothing would render, because the join that draws it runs under RLS
 * too, but a row nobody can ever see is still a row not worth writing.
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

/** Returns the whole board rather than a diff: it is one query and never wrong. */
export async function settleJobOnCanvas(raw: unknown): Promise<NodeRecord[]> {
  const parsed = materializeRequest.safeParse(raw)
  if (!parsed.success) return []
  const actorId = await ensureActorId()
  return withActor(db(), actorId, async (tx) => {
    if (!(await findCanvas(tx, parsed.data.canvasId))) return []
    await materializeJob(tx, {
      canvasId: parsed.data.canvasId,
      ownerId: actorId,
      jobId: parsed.data.jobId,
    })
    return listNodes(tx, parsed.data.canvasId)
  })
}
