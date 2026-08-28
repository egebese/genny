/**
 * The least an asset has to be to be searched: the handle it goes by, and what
 * a model said it is, when one has been asked.
 */
export type Searchable = {
  label: string
  facts: {
    shortName: string
    subject: string
    kind: string
    groupKey: string
    tags: string[]
  } | null
}

/**
 * Whether one asset answers what was typed.
 *
 * Every word has to match something, so "hoodie concrete" narrows rather than
 * widens. Substring rather than whole word, because half of what people type
 * is a stem: "plinth" should find "plinths" and "light" should find "lighting".
 *
 * The handle is searched too. It is a poor name, but it is the one that appears
 * in prompts, so somebody who remembers writing `@wet-slate-2` should find it.
 */
export function matches(asset: Searchable, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const haystack = [
    asset.label,
    asset.facts?.shortName ?? '',
    asset.facts?.subject ?? '',
    asset.facts?.kind ?? '',
    asset.facts?.groupKey ?? '',
    ...(asset.facts?.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return words.every((word) => haystack.includes(word))
}

/**
 * Assets that a model said are the same subject, grouped by that key.
 *
 * The offer, not the group. Four shots sharing `offwhite-oversize-hoodie` is a
 * strong hint and not a decision: the person may have meant them as one product
 * or as four separate listings, and only they know. Singletons are dropped,
 * since "these one things belong together" is not a suggestion.
 */
export function looksGrouped<T extends Searchable & { id: string }>(
  assets: readonly T[],
): { groupKey: string; assets: T[] }[] {
  const byKey = new Map<string, T[]>()
  for (const asset of assets) {
    const key = asset.facts?.groupKey
    if (!key) continue
    const found = byKey.get(key)
    if (found) found.push(asset)
    else byKey.set(key, [asset])
  }

  return [...byKey.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([groupKey, members]) => ({ groupKey, assets: members }))
    .sort((a, b) => b.assets.length - a.assets.length)
}
