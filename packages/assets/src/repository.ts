import type { Database } from '@genny/db/client.ts'
import { assets } from '@genny/db/schema/assets.ts'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import type { MediaKind } from './media.ts'

export type AssetRecord = {
  id: string
  kind: MediaKind
  label: string
  storageKey: string
  mime: string
  bytes: number
  width: number | null
  height: number | null
  durationMs: number | null
  source: 'upload' | 'generation' | 'external'
  jobId: string | null
  createdAt: Date
}

const columns = {
  id: assets.id,
  kind: assets.kind,
  label: assets.label,
  storageKey: assets.storageKey,
  mime: assets.mime,
  bytes: assets.bytes,
  width: assets.width,
  height: assets.height,
  durationMs: assets.durationMs,
  source: assets.source,
  jobId: assets.jobId,
  createdAt: assets.createdAt,
}

export type NewAsset = {
  ownerId: string
  kind: MediaKind
  label: string
  storageKey: string
  mime: string
  bytes: number
  width?: number | null
  height?: number | null
  durationMs?: number | null
  source: 'upload' | 'generation' | 'external'
  jobId?: string | null
}

export async function createAsset(tx: Database, input: NewAsset): Promise<AssetRecord> {
  const [row] = await tx
    .insert(assets)
    .values({
      ownerId: input.ownerId,
      kind: input.kind,
      label: input.label,
      storageKey: input.storageKey,
      mime: input.mime,
      bytes: input.bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      durationMs: input.durationMs ?? null,
      source: input.source,
      jobId: input.jobId ?? null,
    })
    .returning(columns)
  if (!row) throw new Error('asset insert returned no row')
  return row as AssetRecord
}

export async function listAssets(
  tx: Database,
  options: { limit: number; kind?: MediaKind | undefined; before?: Date | undefined },
): Promise<AssetRecord[]> {
  const filters = [
    options.kind ? eq(assets.kind, options.kind) : undefined,
    options.before ? lt(assets.createdAt, options.before) : undefined,
  ].filter((clause) => clause !== undefined)

  const rows = await tx
    .select(columns)
    .from(assets)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(assets.createdAt))
    .limit(Math.min(options.limit, 100))
  return rows as AssetRecord[]
}

/** Labels already in use, so a new one can avoid colliding. */
export async function takenLabels(tx: Database): Promise<string[]> {
  const rows = await tx.select({ label: assets.label }).from(assets)
  return rows.map((row) => row.label)
}

export async function findAssetsByIds(tx: Database, ids: string[]): Promise<AssetRecord[]> {
  if (ids.length === 0) return []
  const rows = await tx.select(columns).from(assets).where(inArray(assets.id, ids))
  return rows as AssetRecord[]
}

export async function deleteAsset(tx: Database, id: string): Promise<AssetRecord | null> {
  const [row] = await tx.delete(assets).where(eq(assets.id, id)).returning(columns)
  return (row as AssetRecord | undefined) ?? null
}
