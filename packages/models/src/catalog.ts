import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ModelDefinition, modelDefinition } from './schema.ts'

const catalogRoot = join(dirname(fileURLToPath(import.meta.url)), '../catalog')

export type CatalogEntry = {
  definition: ModelDefinition
  /** Fingerprint of the file on disk, so drift against the database is visible. */
  hash: string
  path: string
}

/**
 * Reads every catalog file and validates it. A malformed entry throws with its
 * path, because a model that is half-defined is worse than one that is absent:
 * it reaches the picker and fails at generation time, after the user has waited.
 */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = []
  for (const modality of await readdir(catalogRoot)) {
    const dir = join(catalogRoot, modality)
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.json')) continue
      const path = join(dir, file)
      const raw = await readFile(path, 'utf8')
      const parsed = modelDefinition.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        throw new Error(`Invalid model catalog entry ${modality}/${file}:\n${parsed.error.message}`)
      }
      entries.push({
        definition: parsed.data,
        hash: createHash('sha256').update(raw).digest('hex').slice(0, 16),
        path,
      })
    }
  }
  return entries.sort((a, b) => a.definition.sortOrder - b.definition.sortOrder)
}
