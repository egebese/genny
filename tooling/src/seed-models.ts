import { seedModels } from '@genny/db/seed-models.ts'
import { loadCatalog } from '@genny/models/catalog.ts'

/**
 * Pushes the catalog files into the models table. Run after adding a model and
 * after every deploy. Idempotent: it updates what a model *is* and leaves what an
 * operator has decided about it alone.
 */
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_MIGRATION_URL or DATABASE_URL must be set')
  process.exit(1)
}

const entries = await loadCatalog()
const { inserted, updated } = await seedModels(url, entries)
console.warn(`models seeded: ${inserted} new, ${updated} updated, ${entries.length} total`)
