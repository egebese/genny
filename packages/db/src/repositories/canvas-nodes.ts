import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { assets } from '../schema/assets.ts'
import { canvasNodes } from '../schema/canvas.ts'
import { jobs } from '../schema/jobs.ts'
import type { JobStatus } from './jobs.ts'

export type NodeRecord = {
  id: string
  x: number
  y: number
  width: number
  height: number
  jobId: string | null
  outputIndex: number
  assetId: string | null
  createdAt: Date
  /** Everything below is the joined asset, null while the job is still running. */
  kind: 'image' | 'video' | 'audio' | null
  label: string | null
  storageKey: string | null
  durationMs: number | null
  /** Null for a node placed from an existing asset rather than generated. */
  status: JobStatus | null
  error: string | null
  endpointId: string | null
}

const columns = {
  id: canvasNodes.id,
  x: canvasNodes.x,
  y: canvasNodes.y,
  width: canvasNodes.width,
  height: canvasNodes.height,
  jobId: canvasNodes.jobId,
  outputIndex: canvasNodes.outputIndex,
  assetId: canvasNodes.assetId,
  createdAt: canvasNodes.createdAt,
  kind: assets.kind,
  label: assets.label,
  storageKey: assets.storageKey,
  durationMs: assets.durationMs,
  status: jobs.status,
  error: jobs.error,
  endpointId: jobs.endpointId,
}

/** Ordered oldest first, so paint order matches the order things were made. */
export async function listNodes(tx: Database, canvasId: string): Promise<NodeRecord[]> {
  const rows = await tx
    .select(columns)
    .from(canvasNodes)
    .leftJoin(assets, eq(assets.id, canvasNodes.assetId))
    .leftJoin(jobs, eq(jobs.id, canvasNodes.jobId))
    .where(eq(canvasNodes.canvasId, canvasId))
    .orderBy(asc(canvasNodes.createdAt))
  return rows as NodeRecord[]
}

export type NewNode = {
  canvasId: string
  ownerId: string
  x: number
  y: number
  width: number
  height: number
  jobId?: string | null
  outputIndex?: number
  assetId?: string | null
}

/**
 * Inserts a node, or does nothing if this job output already has one.
 *
 * The conflict is not an error case: a generation that produced three images is
 * materialised by whoever notices it finished first, and the browser stream and
 * fal's webhook both try. Returns null when the row was already there.
 */
export async function insertNode(tx: Database, input: NewNode): Promise<{ id: string } | null> {
  const [row] = await tx
    .insert(canvasNodes)
    .values({
      canvasId: input.canvasId,
      ownerId: input.ownerId,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      jobId: input.jobId ?? null,
      outputIndex: input.outputIndex ?? 0,
      assetId: input.assetId ?? null,
    })
    .onConflictDoNothing({ target: [canvasNodes.jobId, canvasNodes.outputIndex] })
    .returning({ id: canvasNodes.id })
  return row ?? null
}

/**
 * Attaches the finished asset. Guarded on `asset_id is null` so a second settler
 * arriving late cannot repoint a node the user may already have moved or used.
 */
export async function fillNode(tx: Database, nodeId: string, assetId: string): Promise<boolean> {
  const rows = await tx
    .update(canvasNodes)
    .set({ assetId })
    .where(and(eq(canvasNodes.id, nodeId), isNull(canvasNodes.assetId)))
    .returning({ id: canvasNodes.id })
  return rows.length > 0
}

export async function moveNode(
  tx: Database,
  nodeId: string,
  position: { x: number; y: number },
): Promise<void> {
  await tx.update(canvasNodes).set(position).where(eq(canvasNodes.id, nodeId))
}

export async function deleteNode(tx: Database, nodeId: string): Promise<boolean> {
  const rows = await tx
    .delete(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .returning({ id: canvasNodes.id })
  return rows.length > 0
}

/** Nodes still waiting on their generation. What the load-time sync works from. */
export async function unfilledNodes(
  tx: Database,
  canvasId: string,
): Promise<{ id: string; jobId: string; x: number; y: number; width: number; height: number }[]> {
  const rows = await tx
    .select({
      id: canvasNodes.id,
      jobId: canvasNodes.jobId,
      x: canvasNodes.x,
      y: canvasNodes.y,
      width: canvasNodes.width,
      height: canvasNodes.height,
    })
    .from(canvasNodes)
    .where(and(eq(canvasNodes.canvasId, canvasId), isNull(canvasNodes.assetId)))
  return rows.filter((row): row is (typeof rows)[number] & { jobId: string } => row.jobId !== null)
}
