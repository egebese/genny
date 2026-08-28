import { desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { assets } from '../schema/assets.ts'
import { canvases, canvasNodes } from '../schema/canvas.ts'

export type Viewport = { x: number; y: number; zoom: number }

export type CanvasRecord = {
  id: string
  projectId: string
  title: string
  viewport: Viewport
  createdAt: Date
  updatedAt: Date
}

export type CanvasSummary = CanvasRecord & {
  nodeCount: number
  /** Newest image on the board, used as the card's thumbnail. Null on an empty one. */
  coverAssetId: string | null
  coverLabel: string | null
  coverStorageKey: string | null
}

const columns = {
  id: canvases.id,
  projectId: canvases.projectId,
  title: canvases.title,
  viewport: canvases.viewport,
  createdAt: canvases.createdAt,
  updatedAt: canvases.updatedAt,
}

export async function createCanvas(
  tx: Database,
  input: { ownerId: string; projectId: string; title: string },
): Promise<CanvasRecord> {
  const [row] = await tx
    .insert(canvases)
    .values({ ownerId: input.ownerId, projectId: input.projectId, title: input.title })
    .returning(columns)
  if (!row) throw new Error('canvas insert returned no row')
  return row as CanvasRecord
}

export async function findCanvas(tx: Database, id: string): Promise<CanvasRecord | null> {
  const [row] = await tx.select(columns).from(canvases).where(eq(canvases.id, id)).limit(1)
  return (row as CanvasRecord | undefined) ?? null
}

/**
 * Every canvas the actor can see, newest first, or only one project's.
 *
 * The cover comes from a lateral subquery rather than a join plus a group by:
 * one board can hold hundreds of nodes and we want exactly one row back per
 * canvas regardless.
 */
export async function listCanvases(
  tx: Database,
  options: { projectId?: string | undefined; limit?: number } = {},
): Promise<CanvasSummary[]> {
  const cover = tx
    .select({
      canvasId: canvasNodes.canvasId,
      assetId: assets.id,
      label: assets.label,
      storageKey: assets.storageKey,
      rank: sql<number>`row_number() over (
        partition by ${canvasNodes.canvasId} order by ${canvasNodes.createdAt} desc
      )`.as('rank'),
    })
    .from(canvasNodes)
    .innerJoin(assets, eq(assets.id, canvasNodes.assetId))
    .where(eq(assets.kind, 'image'))
    .as('cover')

  const rows = await tx
    .select({
      ...columns,
      nodeCount: sql<number>`(
        select count(*)::int from ${canvasNodes} where ${canvasNodes.canvasId} = ${canvases.id}
      )`,
      coverAssetId: cover.assetId,
      coverLabel: cover.label,
      coverStorageKey: cover.storageKey,
    })
    .from(canvases)
    .leftJoin(cover, sql`${cover.canvasId} = ${canvases.id} and ${cover.rank} = 1`)
    .where(options.projectId ? eq(canvases.projectId, options.projectId) : undefined)
    .orderBy(desc(canvases.updatedAt))
    .limit(Math.min(options.limit ?? 60, 100))

  return rows as CanvasSummary[]
}

export async function renameCanvas(tx: Database, id: string, title: string): Promise<void> {
  await tx.update(canvases).set({ title, updatedAt: new Date() }).where(eq(canvases.id, id))
}

/**
 * Viewport writes are frequent and worthless if lost, so they deliberately do
 * not bump `updatedAt`: panning around an old board should not push it to the
 * top of the list ahead of one you actually changed.
 */
export async function saveViewport(tx: Database, id: string, viewport: Viewport): Promise<void> {
  await tx.update(canvases).set({ viewport }).where(eq(canvases.id, id))
}

export async function touchCanvas(tx: Database, id: string): Promise<void> {
  await tx.update(canvases).set({ updatedAt: new Date() }).where(eq(canvases.id, id))
}

export async function deleteCanvas(tx: Database, id: string): Promise<boolean> {
  const rows = await tx.delete(canvases).where(eq(canvases.id, id)).returning({ id: canvases.id })
  return rows.length > 0
}
