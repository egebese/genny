import type { Database } from '@genny/db/client.ts'
import { assetGroupMembers, assetGroups, assets } from '@genny/db/schema/assets.ts'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { findAssetsByIds } from './repository.ts'

export type GroupKind = 'character' | 'product' | 'style' | 'set'

export type GroupRecord = {
  id: string
  label: string
  /** What the set stands for. Decides how the library files it. */
  kind: GroupKind
  description: string | null
  createdAt: Date
  /** Storage keys of its reference images, in the order they should be sent. */
  members: {
    assetId: string
    storageKey: string
    mime: string
    /** Carried so a member can be sent to fal without being looked up again. */
    falUrl: string | null
    falUrlAt: Date | null
  }[]
}

/**
 * A named bundle of assets. `@ayse` resolves to all of them and so does
 * `@offwhite-hoodie`, which is what keeps a subject stable across generations
 * without re-picking four files every time.
 *
 * A character was the only kind this could be, and four angles of a hoodie is
 * the same shape of thing with a different name for it.
 */
export async function createGroup(
  tx: Database,
  input: {
    ownerId: string
    label: string
    kind?: GroupKind | undefined
    description?: string | null
    assetIds: string[]
  },
): Promise<GroupRecord> {
  if (input.assetIds.length === 0) throw new Error('a group needs at least one asset')

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
    .insert(assetGroups)
    .values({
      ownerId: input.ownerId,
      label: input.label,
      kind: input.kind ?? 'character',
      description: input.description ?? null,
    })
    .returning({
      id: assetGroups.id,
      label: assetGroups.label,
      kind: assetGroups.kind,
      description: assetGroups.description,
      createdAt: assetGroups.createdAt,
    })
  if (!row) throw new Error('group insert returned no row')

  await tx.insert(assetGroupMembers).values(
    input.assetIds.map((assetId, index) => ({
      groupId: row.id,
      assetId,
      ownerId: input.ownerId,
      sortOrder: index,
    })),
  )

  return { ...row, members: await membersOf(tx, row.id) }
}

export async function listGroups(tx: Database, limit = 50): Promise<GroupRecord[]> {
  const rows = await tx
    .select({
      id: assetGroups.id,
      label: assetGroups.label,
      kind: assetGroups.kind,
      description: assetGroups.description,
      createdAt: assetGroups.createdAt,
    })
    .from(assetGroups)
    .orderBy(desc(assetGroups.createdAt))
    .limit(Math.min(limit, 100))

  // One query for the members of every character, rather than one per character.
  const ids = rows.map((row) => row.id)
  const grouped = await membersByCharacter(tx, ids)
  return rows.map((row) => ({ ...row, members: grouped.get(row.id) ?? [] }))
}

export async function findGroupsByIds(tx: Database, ids: string[]): Promise<GroupRecord[]> {
  if (ids.length === 0) return []
  const rows = await tx
    .select({
      id: assetGroups.id,
      label: assetGroups.label,
      kind: assetGroups.kind,
      description: assetGroups.description,
      createdAt: assetGroups.createdAt,
    })
    .from(assetGroups)
    .where(inArray(assetGroups.id, ids))

  const grouped = await membersByCharacter(
    tx,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({ ...row, members: grouped.get(row.id) ?? [] }))
}

export async function deleteGroup(tx: Database, id: string): Promise<boolean> {
  const removed = await tx
    .delete(assetGroups)
    .where(eq(assetGroups.id, id))
    .returning({ id: assetGroups.id })
  return removed.length > 0
}

export async function takenGroupLabels(tx: Database): Promise<string[]> {
  const rows = await tx.select({ label: assetGroups.label }).from(assetGroups)
  return rows.map((row) => row.label)
}

async function membersOf(tx: Database, groupId: string) {
  return (await membersByCharacter(tx, [groupId])).get(groupId) ?? []
}

async function membersByCharacter(tx: Database, characterIds: string[]) {
  const grouped = new Map<string, GroupRecord['members']>()
  if (characterIds.length === 0) return grouped

  const rows = await tx
    .select({
      groupId: assetGroupMembers.groupId,
      assetId: assets.id,
      storageKey: assets.storageKey,
      mime: assets.mime,
      falUrl: assets.falUrl,
      falUrlAt: assets.falUrlAt,
      sortOrder: assetGroupMembers.sortOrder,
    })
    .from(assetGroupMembers)
    .innerJoin(assets, eq(assets.id, assetGroupMembers.assetId))
    .where(inArray(assetGroupMembers.groupId, characterIds))
    .orderBy(asc(assetGroupMembers.sortOrder))

  for (const row of rows) {
    const list = grouped.get(row.groupId) ?? []
    list.push({
      assetId: row.assetId,
      storageKey: row.storageKey,
      mime: row.mime,
      falUrl: row.falUrl,
      falUrlAt: row.falUrlAt,
    })
    grouped.set(row.groupId, list)
  }
  return grouped
}
