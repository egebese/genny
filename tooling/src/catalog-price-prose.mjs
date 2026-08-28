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

/**
 * Whether the number in the catalog appears in fal's own price sentence.
 *
 * The second source, for the entries that have opted out of the first.
 *
 * A waiver used to mean "do not check this", which put every entry most likely
 * to be wrong beyond the reach of the only thing that could catch it: H3 Max
 * was resold at a two hundredth of its cost for as long as it shipped, and the
 * note explaining the price is what silenced the check. A waiver now means
 * "check it against the published page instead".
 *
 * Matched against every figure on the page rather than parsed into one number.
 * The prose is where the conditions live, and a page listing six rates is
 * telling the truth about six rates; what we can verify is that ours is one of
 * them, which is exactly the thing that was wrong before.
 */
export function proseMentions(endpointId, unitPriceUsd) {
  const body = fetchText(`https://fal.ai/models/${endpointId}/llms.txt`)
  if (body === null) return { ok: false, reason: 'could not fetch' }
  const pricing = body.split(/^## /m).find((section) => section.startsWith('Pricing'))
  if (!pricing) return { ok: false, reason: 'no pricing section on the page' }

  const figures = figuresIn(pricing)
  /*
   * The same price, said in a different unit.
   *
   * fal quotes text to speech per thousand characters and some music per
   * thirty seconds, where the catalog stores a rate per character and per
   * second: $0.1 per 1000 and $0.0001 each are the same money, and failing on
   * that would be a false alarm every week until somebody turned the check off.
   *
   * A conversion, not a tolerance. The thing this exists to catch is an entry
   * off by two orders of magnitude, and none of these factors can hide one.
   */
  return { ok: true, found: matchesPrice(figures, unitPriceUsd), figures }
}

/** Every dollar amount in a piece of fal's prose, in the order it says them. */
export function figuresIn(prose) {
  const found = [...prose.matchAll(/\$\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\s*\$/g)]
  return found.map((match) => Number((match[1] ?? match[2]).replace(/,/g, '').replace(/\.$/, '')))
}

/** Whether one of those figures is the catalog's price, in some unit. */
export function matchesPrice(figures, unitPriceUsd) {
  const asWritten = [1, 1000, 1_000_000, 60, 30].map((per) => unitPriceUsd * per)
  return figures.some((figure) => asWritten.some((price) => close(figure, price)))
}

/**
 * Relative, because a per-character price is 0.0001 and a per-clip one is 5.
 *
 * Half a percent, which is a rounding allowance rather than a tolerance for
 * being wrong. Lyria bills $0.1 per thirty seconds, so a per-second entry is
 * 0.00333 and multiplies back to 0.0999; failing on that would be a false
 * alarm every week until somebody switched the check off, which is the road
 * that ended with an endpoint resold at a two hundredth of its cost. Nothing
 * this exists to catch is within half a percent of right.
 */
function close(a, b) {
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 0.005
}
