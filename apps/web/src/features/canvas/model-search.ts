import type { PickableFamily } from './family-list.ts'

/**
 * Which models a search shows, and in what order.
 *
 * Ours rather than cmdk's, which scores a search's letters found scattered in
 * order anywhere in the value. At thirty-five models that matches almost
 * everything and then ranks by how short the name happens to be: "upscale" put
 * FLUX.1 [schnell] above the three models with the word in their name. Nobody
 * typing seven letters wants them spread across a different word.
 *
 * The name wins over the keywords and the start of it over the middle, so
 * "kling" reaches Kling before something whose endpoint id merely contains it.
 * Ties keep catalog order, which is what the picker shows when nothing is typed.
 */
export function matching(models: readonly PickableFamily[], search: string): PickableFamily[] {
  const term = search.trim().toLowerCase()
  if (!term) return [...models]
  return models
    .map((model, at) => ({ model, at, rank: rankOf(model, term) }))
    .filter((scored) => scored.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.at - b.at)
    .map((scored) => scored.model)
}

function rankOf(model: PickableFamily, term: string): number {
  const name = model.name.toLowerCase()
  if (name.startsWith(term)) return 3
  if (name.includes(term)) return 2
  return model.keywords.some((keyword) => keyword.includes(term)) ? 1 : 0
}
