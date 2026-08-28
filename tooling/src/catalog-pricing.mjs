import { execFileSync } from 'node:child_process'

/**
 * How many ids one request will take.
 *
 * Not a guess: 112 in one call answers 400 `validation_error`, and 25 answers
 * fine. The other direction is worse, because asking one at a time earns a 429
 * and a rate-limited answer looks exactly like "this endpoint has no price"
 * unless you are careful.
 */
const PER_REQUEST = 25

/**
 * Every catalog price, in as few requests as the API will take.
 *
 * Nothing here may treat a failed fetch as a fact, which is why this throws
 * rather than returning an empty map: a laptop on a plane and a catalog that is
 * wrong must not look the same.
 */
export function fetchPrices(endpointIds) {
  const prices = new Map()
  for (let at = 0; at < endpointIds.length; at += PER_REQUEST) {
    for (const [id, price] of askFor(endpointIds.slice(at, at + PER_REQUEST))) {
      prices.set(id, price)
    }
  }
  return prices
}

function askFor(endpointIds) {
  if (endpointIds.length === 0) return new Map()

  const raw = execFileSync('genmedia', ['pricing', endpointIds.join(',')], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    // Captured, not inherited: `execFileSync` lets stderr through by default, so
    // a missing key printed the CLI's own JSON error above our explanation of it.
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const body = JSON.parse(raw)
  if (body.error) throw new Error(`genmedia pricing: ${body.error}`)

  return new Map(
    (body.prices ?? []).map((price) => [
      price.endpoint_id,
      { unitPriceUsd: price.unit_price, unit: price.unit },
    ]),
  )
}

/**
 * The same fetch, told apart from a network problem.
 *
 * A price check has three outcomes, not two, and collapsing the third is how it
 * becomes useless: agreeing, disagreeing, and not having been able to ask. A
 * laptop on a plane and a catalog that is wrong must not look the same, and
 * neither may quietly pass.
 */
export function tryFetchPrices(endpointIds) {
  try {
    return { ok: true, prices: fetchPrices(endpointIds) }
  } catch (error) {
    /*
     * The CLI says why in its own output, and the thrown message is the whole
     * command line with seventeen endpoint ids in it. Whichever stream carried
     * the sentence is the half worth repeating.
     */
    const said = tellMe(error?.stdout) ?? tellMe(error?.stderr)
    return { ok: false, reason: said ?? (error instanceof Error ? error.message : String(error)) }
  }
}

/**
 * The same price, in the units the catalog uses.
 *
 * genmedia and our schema disagree about wording rather than about money:
 * `1000 characters` is our `characters` with the decimal moved, and `audios` is
 * one request. Reporting those as drift would train everyone to ignore the
 * report, which is the only way this check can actually fail.
 */
export function normalise(quoted) {
  const table = {
    '1000 characters': { unit: 'characters', divide: 1000 },
    '1k characters': { unit: 'characters', divide: 1000 },
    audios: { unit: 'requests', divide: 1 },
    images: { unit: 'images', divide: 1 },
    videos: { unit: 'requests', divide: 1 },
  }
  const rule = table[quoted.unit?.toLowerCase() ?? '']
  return rule
    ? { unit: rule.unit, unitPriceUsd: quoted.unitPriceUsd / rule.divide }
    : { unit: quoted.unit, unitPriceUsd: quoted.unitPriceUsd }
}

/** Close enough that the difference is float noise rather than a price change. */
function same(a, b) {
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6)
}

/**
 * What to say about one entry, or null when it agrees.
 *
 * Never returns "fine" for a missing quote. genmedia not answering for an
 * endpoint is a thing to look at, not a thing to pass.
 */
export function comparePrice(entry, quoted) {
  if (!quoted) {
    return `${entry.endpointId}: genmedia has no price for this. Unlisted endpoints answer generations fine and are absent here, so check it against fal's own page before trusting the catalog number.`
  }

  const fal = normalise(quoted)
  const ours = entry.pricing

  if (fal.unit !== ours.unit) {
    return `${entry.endpointId}: billed per ${fal.unit} by fal, catalog says per ${ours.unit}. The estimate is computing the wrong quantity, not just the wrong number.`
  }
  if (same(ours.unitPriceUsd, fal.unitPriceUsd)) return null

  const direction = fal.unitPriceUsd > ours.unitPriceUsd ? 'UP' : 'DOWN'
  const under = fal.unitPriceUsd > ours.unitPriceUsd ? ' We are undercharging.' : ''
  return `${entry.endpointId}: price moved ${direction}. Catalog $${ours.unitPriceUsd}, genmedia $${fal.unitPriceUsd} per ${fal.unit}.${under}`
}

/** The CLI answers errors as JSON on stdout. Pull the sentence out of it. */
function tellMe(output) {
  if (typeof output !== 'string' || output.trim() === '') return null
  try {
    const body = JSON.parse(output)
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return output.split('\n')[0]?.trim() || null
  }
}
