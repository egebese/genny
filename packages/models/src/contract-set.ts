import type { CatalogEntry } from './catalog.ts'
import type { Violation } from './contract.ts'

/**
 * The contract rules that are about the catalog as a whole rather than about
 * one entry, which is why they cannot be written as a `check(entry)` like the
 * rest and live here instead.
 */
/**
 * A family is a set, so its rule is about the set rather than about one entry.
 *
 * The name is repeated on every member because deriving it would mean picking
 * whichever member happens to sort first; repeating it means they can disagree,
 * so they are checked.
 */
export function familyViolations(entries: readonly CatalogEntry[]): Violation[] {
  const names = new Map<string, string>()
  const found: Violation[] = []

  for (const { definition } of entries) {
    const seen = names.get(definition.family.id)
    if (seen === undefined) {
      names.set(definition.family.id, definition.family.name)
    } else if (seen !== definition.family.name) {
      found.push({
        endpointId: definition.endpointId,
        rule: 'family-agrees-on-its-name',
        detail: `calls its family "${definition.family.name}" where another member calls it "${seen}"`,
      })
    }
  }
  return found
}

/**
 * Two entries claiming the same place in the order.
 *
 * `loadCatalog` sorts on `sortOrder`, and a tie falls back to whatever order
 * the filesystem listed the files in. That decides the picker's order and, at
 * position zero, which model the dock opens on: two machines, two answers.
 */
export function orderViolations(entries: readonly CatalogEntry[]): Violation[] {
  const seen = new Map<number, string>()
  const found: Violation[] = []
  for (const { definition } of entries) {
    const taken = seen.get(definition.sortOrder)
    if (taken === undefined) {
      seen.set(definition.sortOrder, definition.endpointId)
      continue
    }
    found.push({
      endpointId: definition.endpointId,
      rule: 'sort-order-is-unique',
      detail: `sortOrder ${definition.sortOrder} is already taken by ${taken}`,
    })
  }
  return found
}
