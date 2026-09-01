import type { Database } from '@genny/db/client.ts'
import { assets } from '@genny/db/schema/assets.ts'
import { and, desc, eq, inArray, isNull, like, lt } from 'drizzle-orm'
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
  /** Where fal can fetch this, if it has been sent there, and when. */
  falUrl: string | null
  falUrlAt: Date | null
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
  falUrl: assets.falUrl,
  falUrlAt: assets.falUrlAt,
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
    live,
    options.kind ? eq(assets.kind, options.kind) : undefined,
    options.before ? lt(assets.createdAt, options.before) : undefined,
  ].filter((clause) => clause !== undefined)

  const rows = await tx
    .select(columns)
    .from(assets)
    .where(and(...filters))
    .orderBy(desc(assets.createdAt))
    .limit(Math.min(options.limit, 100))
  return rows as AssetRecord[]
}

/**
 * Rows that have not been deleted.
 *
 * A tombstone keeps the id resolvable so a canvas node can say its media is
 * gone rather than vanishing, but it must not appear in a library, a mention or
 * anything handed to fal. Every read here carries this.
 */
const live = isNull(assets.deletedAt)

/** A job's outputs, oldest first, which is the order fal returned them in. */
export async function findAssetsByJob(tx: Database, jobId: string): Promise<AssetRecord[]> {
  const rows = await tx
    .select(columns)
    .from(assets)
    .where(and(eq(assets.jobId, jobId), live))
    .orderBy(assets.createdAt, assets.id)
  return rows as AssetRecord[]
}

/**
 * Labels already in use that could collide with this one.
 *
 * Scoped to the stem rather than selecting the owner's entire library, which is
 * what it used to do: every upload and every ingested output read every label
 * the owner had, and the scan grew with the library forever. `uniqueLabel` only
 * ever appends `-2`, `-3` and so on to one stem, so those are the only rows
 * that can matter.
 *
 * Tombstones count. The unique index does not know a row is deleted, so
 * reusing a dead label is a constraint violation rather than a clean insert.
 */
export async function takenLabels(tx: Database, stem?: string): Promise<string[]> {
  const rows = await tx
    .select({ label: assets.label })
    .from(assets)
    .where(stem ? like(assets.label, `${stem}%`) : undefined)
  return rows.map((row) => row.label)
}

export async function findAssetsByIds(tx: Database, ids: string[]): Promise<AssetRecord[]> {
  if (ids.length === 0) return []
  const rows = await tx
    .select(columns)
    .from(assets)
    .where(and(inArray(assets.id, ids), live))
  return rows as AssetRecord[]
}

/**
 * Marks an asset deleted and hands back what the caller needs to remove the
 * bytes.
 *
 * Not a real DELETE: `canvas_nodes.asset_id` cascades, so one would take every
 * node drawing this asset off somebody's board with no warning and no way back.
 * The row survives so the board can say the media is gone.
 *
 * Idempotent, and it reports it: a second call finds nothing still live and
 * returns null, so the storage cleanup does not run twice.
 */
export async function softDeleteAsset(tx: Database, id: string): Promise<AssetRecord | null> {
  const [row] = await tx
    .update(assets)
    .set({ deletedAt: new Date(), falUrl: null, falUrlAt: null })
    .where(and(eq(assets.id, id), live))
    .returning(columns)
  return (row as AssetRecord | undefined) ?? null
}

/**
 * Gives an asset a new @mention handle.
 *
 * Labels were immutable, which meant a slug derived from a filename or from the
 * first eight words of a prompt was the name of that asset forever.
 */
export async function renameAsset(
  tx: Database,
  id: string,
  label: string,
): Promise<AssetRecord | null> {
  const [row] = await tx
    .update(assets)
    .set({ label })
    .where(and(eq(assets.id, id), live))
    .returning(columns)
  return (row as AssetRecord | undefined) ?? null
}

/**
 * Records where fal can fetch this asset from.
 *
 * Written after an upload, read before the next one. fal's guidance is to
 * upload once and reuse the url; without somewhere to keep it, every
 * generation that referenced an asset sent its bytes again.
 */
export async function rememberFalUrl(tx: Database, id: string, url: string): Promise<void> {
  await tx.update(assets).set({ falUrl: url, falUrlAt: new Date() }).where(eq(assets.id, id))
}
