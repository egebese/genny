import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { assets } from '../schema/assets.ts'
import { projectAssets } from '../schema/brand.ts'

export type BrandRole = 'logo' | 'product' | 'reference'

export type BrandItem = {
  assetId: string
  role: BrandRole
  sortOrder: number
  label: string
  storageKey: string
  mime: string
  kind: 'image' | 'video' | 'audio'
}

export async function listBrandKit(tx: Database, projectId: string): Promise<BrandItem[]> {
  return await tx
    .select({
      assetId: projectAssets.assetId,
      role: projectAssets.role,
      sortOrder: projectAssets.sortOrder,
      label: assets.label,
      storageKey: assets.storageKey,
      mime: assets.mime,
      kind: assets.kind,
    })
    .from(projectAssets)
    .innerJoin(assets, eq(assets.id, projectAssets.assetId))
    .where(eq(projectAssets.projectId, projectId))
    .orderBy(asc(projectAssets.role), asc(projectAssets.sortOrder), asc(assets.label))
}

/**
 * Pins an asset, or moves one that is already pinned to a different role.
 *
 * `(project_id, asset_id)` is the key, so the same photograph cannot be both a
 * product and a reference in one project. It can be either, and changing which
 * is a move rather than a second row.
 */
export async function pinToProject(
  tx: Database,
  input: { projectId: string; assetId: string; ownerId: string; role: BrandRole },
): Promise<void> {
  await tx
    .insert(projectAssets)
    .values({
      projectId: input.projectId,
      assetId: input.assetId,
      ownerId: input.ownerId,
      role: input.role,
    })
    .onConflictDoUpdate({
      target: [projectAssets.projectId, projectAssets.assetId],
      set: { role: input.role },
    })
}

export async function unpinFromProject(
  tx: Database,
  input: { projectId: string; assetId: string },
): Promise<boolean> {
  const rows = await tx
    .delete(projectAssets)
    .where(
      and(eq(projectAssets.projectId, input.projectId), eq(projectAssets.assetId, input.assetId)),
    )
    .returning({ assetId: projectAssets.assetId })
  return rows.length > 0
}
