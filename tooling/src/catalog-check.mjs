#!/usr/bin/env node
/**
 * The catalog against what fal actually charges, on every `pnpm check`.
 *
 * The contract rules run in `pnpm test` because they need nothing but the files.
 * This one needs the network, so it lives here and is careful about the
 * difference between "the catalog is wrong" and "I could not ask": the first
 * fails, the second warns and passes, and `CATALOG_STRICT=1` makes the second
 * fail too, which is what CI sets.
 *
 *   node tooling/src/catalog-check.mjs
 *   CATALOG_STRICT=1 node tooling/src/catalog-check.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { comparePrice, tryFetchPrices } from './catalog-pricing.mjs'

const catalogRoot = join(dirname(fileURLToPath(import.meta.url)), '../../packages/models/catalog')
const strict = process.env.CATALOG_STRICT === '1'

const entries = []
for (const modality of readdirSync(catalogRoot)) {
  for (const file of readdirSync(join(catalogRoot, modality))) {
    if (file.endsWith('.json')) {
      entries.push(JSON.parse(readFileSync(join(catalogRoot, modality, file), 'utf8')))
    }
  }
}

const quoted = tryFetchPrices(entries.map((entry) => entry.endpointId))
if (!quoted.ok) {
  const message = `catalog prices: could not ask genmedia (${quoted.reason.split('\n')[0]})`
  if (!strict) {
    console.warn(`${message}. Passing; set CATALOG_STRICT=1 to make this fail.`)
    process.exit(0)
  }
  console.error(`${message}. CATALOG_STRICT is on, so this is a failure.`)
  process.exit(1)
}

/**
 * An entry may disagree with genmedia on purpose. genmedia answers $0.005/s for
 * PixVerse against a published $0.03 to $0.12, a base unit no request is ever
 * charged, so the catalog is right and the CLI is not.
 *
 * The waiver is an explicit field, and it used to be the note containing the
 * word "genmedia". That was not a decision anybody made: H3 Max shipped resold
 * at a two hundredth of its cost, and the note explaining the price hid the
 * only check that would have caught it. A waiver has to be meant.
 */
const problems = []
for (const entry of entries) {
  const note = comparePrice(entry, quoted.prices.get(entry.endpointId))
  if (!note) continue
  const waived = entry.pricing?.waiveDriftCheck === true
  if (waived) continue
  problems.push(`${note}\n    No pricing.note explains this. Check fal's own page, then write one.`)
}

if (problems.length > 0) {
  console.error(`\ncatalog prices: ${problems.length} disagree with genmedia\n`)
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('')
  process.exit(1)
}
console.log(`catalog prices: ${entries.length} entries agree with genmedia`)
