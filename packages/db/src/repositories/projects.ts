import { desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { assets } from '../schema/assets.ts'
import { canvasNodes, projects } from '../schema/canvas.ts'

export type Viewport = { x: number; y: number; zoom: number }

export type ProjectRecord = {
  id: string
  title: string
  viewport: Viewport
  createdAt: Date
  updatedAt: Date
}

export type ProjectSummary = ProjectRecord & {
  nodeCount: number
  /** Newest image on the board, used as the card's thumbnail. Null on an empty one. */
  coverAssetId: string | null
  coverLabel: string | null
  coverStorageKey: string | null
}

const columns = {
  id: projects.id,
  title: projects.title,
  viewport: projects.viewport,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
}

export async function createProject(
  tx: Database,
  input: { ownerId: string; title: string },
): Promise<ProjectRecord> {
  const [row] = await tx
    .insert(projects)
    .values({ ownerId: input.ownerId, title: input.title })
    .returning(columns)
  if (!row) throw new Error('project insert returned no row')
  return row as ProjectRecord
}

export async function findProject(tx: Database, id: string): Promise<ProjectRecord | null> {
  const [row] = await tx.select(columns).from(projects).where(eq(projects.id, id)).limit(1)
  return (row as ProjectRecord | undefined) ?? null
}

/**
 * The project list. The cover comes from a lateral subquery rather than a join
 * plus a group by: one board can hold hundreds of nodes and we want exactly one
 * row back per project regardless.
 */
export async function listProjects(tx: Database, limit = 60): Promise<ProjectSummary[]> {
  const cover = tx
    .select({
      projectId: canvasNodes.projectId,
      assetId: assets.id,
      label: assets.label,
      storageKey: assets.storageKey,
      rank: sql<number>`row_number() over (
        partition by ${canvasNodes.projectId} order by ${canvasNodes.createdAt} desc
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
        select count(*)::int from ${canvasNodes} where ${canvasNodes.projectId} = ${projects.id}
      )`,
      coverAssetId: cover.assetId,
      coverLabel: cover.label,
      coverStorageKey: cover.storageKey,
    })
    .from(projects)
    .leftJoin(cover, sql`${cover.projectId} = ${projects.id} and ${cover.rank} = 1`)
    .orderBy(desc(projects.updatedAt))
    .limit(Math.min(limit, 100))

  return rows as ProjectSummary[]
}

export async function renameProject(tx: Database, id: string, title: string): Promise<void> {
  await tx.update(projects).set({ title, updatedAt: new Date() }).where(eq(projects.id, id))
}

/**
 * Viewport writes are frequent and worthless if lost, so they deliberately do
 * not bump `updatedAt`: panning around an old board should not push it to the
 * top of the list ahead of one you actually changed.
 */
export async function saveViewport(tx: Database, id: string, viewport: Viewport): Promise<void> {
  await tx.update(projects).set({ viewport }).where(eq(projects.id, id))
}

export async function touchProject(tx: Database, id: string): Promise<void> {
  await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id))
}

export async function deleteProject(tx: Database, id: string): Promise<boolean> {
  const rows = await tx.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id })
  return rows.length > 0
}
