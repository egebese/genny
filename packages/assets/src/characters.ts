import type { Database } from '@genny/db/client.ts'
import { assets, characterAssets, characters } from '@genny/db/schema/assets.ts'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { findAssetsByIds } from './repository.ts'

export type CharacterRecord = {
  id: string
  label: string
  description: string | null
  createdAt: Date
  /** Storage keys of its reference images, in the order they should be sent. */
  members: { assetId: string; storageKey: string; mime: string }[]
}

/**
 * A named bundle of reference images. `@ayse` resolves to all of them, which is
 * what keeps an identity stable across generations without re-picking four files
 * every time.
 */
export async function createCharacter(
  tx: Database,
  input: { ownerId: string; label: string; description?: string | null; assetIds: string[] },
): Promise<CharacterRecord> {
  if (input.assetIds.length === 0) throw new Error('a character needs at least one asset')

  /*
   * The composite foreign key in the schema is the real guarantee. This check
   * exists so the failure reads as "that asset is not yours" rather than as a
   * constraint violation nobody can act on.
   */
  const visible = await findAssetsByIds(tx, input.assetIds)
  if (visible.length !== new Set(input.assetIds).size) {
    throw new Error('one of those assets does not exist or is not yours')
  }

  const [row] = await tx
    .insert(characters)
    .values({ ownerId: input.ownerId, label: input.label, description: input.description ?? null })
    .returning({
      id: characters.id,
      label: characters.label,
      description: characters.description,
      createdAt: characters.createdAt,
    })
  if (!row) throw new Error('character insert returned no row')

  await tx.insert(characterAssets).values(
    input.assetIds.map((assetId, index) => ({
      characterId: row.id,
      assetId,
      ownerId: input.ownerId,
      sortOrder: index,
    })),
  )

  return { ...row, members: await membersOf(tx, row.id) }
}

export async function listCharacters(tx: Database, limit = 50): Promise<CharacterRecord[]> {
  const rows = await tx
    .select({
      id: characters.id,
      label: characters.label,
      description: characters.description,
      createdAt: characters.createdAt,
    })
    .from(characters)
    .orderBy(desc(characters.createdAt))
    .limit(Math.min(limit, 100))

  // One query for the members of every character, rather than one per character.
  const ids = rows.map((row) => row.id)
  const grouped = await membersByCharacter(tx, ids)
  return rows.map((row) => ({ ...row, members: grouped.get(row.id) ?? [] }))
}

export async function findCharactersByIds(tx: Database, ids: string[]): Promise<CharacterRecord[]> {
  if (ids.length === 0) return []
  const rows = await tx
    .select({
      id: characters.id,
      label: characters.label,
      description: characters.description,
      createdAt: characters.createdAt,
    })
    .from(characters)
    .where(inArray(characters.id, ids))

  const grouped = await membersByCharacter(
    tx,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({ ...row, members: grouped.get(row.id) ?? [] }))
}

export async function deleteCharacter(tx: Database, id: string): Promise<boolean> {
  const removed = await tx
    .delete(characters)
    .where(eq(characters.id, id))
    .returning({ id: characters.id })
  return removed.length > 0
}

export async function takenCharacterLabels(tx: Database): Promise<string[]> {
  const rows = await tx.select({ label: characters.label }).from(characters)
  return rows.map((row) => row.label)
}

async function membersOf(tx: Database, characterId: string) {
  return (await membersByCharacter(tx, [characterId])).get(characterId) ?? []
}

async function membersByCharacter(tx: Database, characterIds: string[]) {
  const grouped = new Map<string, CharacterRecord['members']>()
  if (characterIds.length === 0) return grouped

  const rows = await tx
    .select({
      characterId: characterAssets.characterId,
      assetId: assets.id,
      storageKey: assets.storageKey,
      mime: assets.mime,
      sortOrder: characterAssets.sortOrder,
    })
    .from(characterAssets)
    .innerJoin(assets, eq(assets.id, characterAssets.assetId))
    .where(inArray(characterAssets.characterId, characterIds))
    .orderBy(asc(characterAssets.sortOrder))

  for (const row of rows) {
    const list = grouped.get(row.characterId) ?? []
    list.push({ assetId: row.assetId, storageKey: row.storageKey, mime: row.mime })
    grouped.set(row.characterId, list)
  }
  return grouped
}
