import { sql } from 'drizzle-orm'
import { createClient } from './client.ts'
import { models } from './schema/models.ts'

type CatalogEntry = {
  hash: string
  definition: {
    endpointId: string
    modality: 'image' | 'video' | 'audio'
    group: string
    displayName: string
    thumbnailUrl?: string | undefined
    featured: boolean
    sortOrder: number
    pricing: { unit: string; unitPriceUsd: number }
    creditMultiplier: number
    capabilities: Record<string, unknown>
  }
}

/**
 * Upserts catalog files into the models table.
 *
 * What a model *is* comes from the file and is overwritten every run. What an
 * operator has *decided* about it (enabled, credit multiplier) is set on insert
 * and never touched again, otherwise every deploy would silently undo a price
 * change made from the admin panel.
 */
export async function seedModels(
  url: string,
  entries: CatalogEntry[],
): Promise<{ inserted: number; updated: number }> {
  const client = createClient({ url, max: 1 })
  let inserted = 0
  let updated = 0

  try {
    for (const { definition, hash } of entries) {
      const existing = await client.db.execute<{ endpoint_id: string }>(
        sql`select endpoint_id from models where endpoint_id = ${definition.endpointId}`,
      )
      const isNew = existing.length === 0

      await client.db
        .insert(models)
        .values({
          endpointId: definition.endpointId,
          modality: definition.modality,
          group: definition.group,
          displayName: definition.displayName,
          thumbnailUrl: definition.thumbnailUrl ?? null,
          featured: definition.featured,
          sortOrder: definition.sortOrder,
          unit: definition.pricing.unit,
          unitPriceUsd: definition.pricing.unitPriceUsd.toString(),
          creditMultiplier: definition.creditMultiplier.toString(),
          catalogHash: hash,
          capabilities: definition.capabilities,
        })
        .onConflictDoUpdate({
          target: models.endpointId,
          set: {
            modality: definition.modality,
            group: definition.group,
            displayName: definition.displayName,
            thumbnailUrl: definition.thumbnailUrl ?? null,
            sortOrder: definition.sortOrder,
            unit: definition.pricing.unit,
            unitPriceUsd: definition.pricing.unitPriceUsd.toString(),
            catalogHash: hash,
            capabilities: definition.capabilities,
            updatedAt: new Date(),
          },
        })

      if (isNew) inserted++
      else updated++
    }
  } finally {
    await client.sql.end()
  }

  return { inserted, updated }
}
