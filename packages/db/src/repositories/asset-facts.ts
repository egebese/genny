import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { assetFacts } from '../schema/facts.ts'

export type AssetKindGuess =
  | 'product'
  | 'character'
  | 'logo'
  | 'scene'
  | 'texture'
  | 'diagram'
  | 'other'

export type AssetFacts = {
  assetId: string
  shortName: string
  kind: AssetKindGuess
  subject: string
  palette: string[]
  tags: string[]
  groupKey: string
  model: string
  analysedAt: Date
}

const columns = {
  assetId: assetFacts.assetId,
  shortName: assetFacts.shortName,
  kind: assetFacts.kind,
  subject: assetFacts.subject,
  palette: assetFacts.palette,
  tags: assetFacts.tags,
  groupKey: assetFacts.groupKey,
  model: assetFacts.model,
  analysedAt: assetFacts.analysedAt,
}

/**
 * Records what an asset is, replacing whatever was there.
 *
 * Replacing rather than appending: this is a description, and keeping every
 * version of one would be a history of our prompt engineering filed under
 * somebody's photograph.
 */
export async function recordAssetFacts(
  tx: Database,
  input: Omit<AssetFacts, 'analysedAt'> & { ownerId: string },
): Promise<void> {
  const row = {
    assetId: input.assetId,
    ownerId: input.ownerId,
    shortName: input.shortName,
    kind: input.kind,
    subject: input.subject,
    palette: input.palette,
    tags: input.tags,
    groupKey: input.groupKey,
    model: input.model,
    analysedAt: new Date(),
  }
  await tx
    .insert(assetFacts)
    .values(row)
    .onConflictDoUpdate({ target: assetFacts.assetId, set: row })
}

export async function factsFor(tx: Database, assetIds: string[]): Promise<AssetFacts[]> {
  if (assetIds.length === 0) return []
  const rows = await tx
    .select(columns)
    .from(assetFacts)
    .where(inArray(assetFacts.assetId, assetIds))
  return rows as AssetFacts[]
}

/** True when this asset has already been catalogued, so nobody pays twice. */
export async function isCatalogued(tx: Database, assetId: string): Promise<boolean> {
  const [row] = await tx
    .select({ assetId: assetFacts.assetId })
    .from(assetFacts)
    .where(eq(assetFacts.assetId, assetId))
    .limit(1)
  return row !== undefined
}
