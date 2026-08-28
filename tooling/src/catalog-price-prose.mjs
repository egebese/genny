import { execFileSync } from 'node:child_process'

/**
 * What fal says a request costs, in fal's own words.
 *
 * The authority on price, and not `genmedia pricing`. That answers `compute
 * seconds` and `units` for a third of the catalog, neither of which is what a
 * request is charged: H3 Max shipped resold at a two hundredth of its cost
 * because the compute-second row was taken for the price. The published page
 * carries the real per-second and per-image rates, and the conditions on them.
 *
 * Returned as prose rather than parsed into a number on purpose. `AGENTS.md`
 * says prices are reported and never written, because the conditions are where
 * the mistakes live: promotional rates with an end date, tiers by resolution,
 * a surcharge for a web search. A person reads this and writes the number.
 */
export function priceProse(endpointId) {
  const body = fetchText(`https://fal.ai/models/${endpointId}/llms.txt`)
  if (!body) return null
  const pricing = body.split(/^## /m).find((section) => section.startsWith('Pricing'))
  if (!pricing) return null
  const said = pricing
    .replace(/^Pricing\s*/, '')
    .split('\n')
    .filter((line) => line.includes('$') || /per\s/i.test(line))
    .map((line) => line.replace(/\*\*/g, '').trim())
    .filter(Boolean)
  return said.length > 0 ? `fal publishes: ${said.join(' ')}` : null
}

function fetchText(url) {
  try {
    return execFileSync('curl', ['-sS', '--max-time', '25', url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    // A price we could not fetch is not a price of zero. The caller writes TODO.
    return null
  }
}
