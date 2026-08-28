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
import { proseMentions } from './catalog-price-prose.mjs'
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
  if (entry.pricing?.waiveDriftCheck !== true) {
    problems.push(
      `${note}\n    Nothing waives this. Check fal's own page, then say so in the entry.`,
    )
  }
}

/*
 * The waived ones, against the other source. Only these, because the rest have
 * already been compared with the CLI and a second fetch would say the same
 * thing twice; and only after that comparison, so a page that cannot be reached
 * is reported next to a price that is merely unverified rather than wrong.
 */
const unreachable = []
let verified = 0
for (const entry of entries) {
  if (entry.pricing?.waiveDriftCheck !== true) continue
  verified += 1
  const said = proseMentions(entry.endpointId, entry.pricing.unitPriceUsd)
  if (!said.ok) {
    unreachable.push(`${entry.endpointId}: ${said.reason}`)
    continue
  }
  if (said.found) continue
  problems.push(
    `${entry.endpointId}: the catalog says $${entry.pricing.unitPriceUsd} per ` +
      `${entry.pricing.unit}, and fal's own page names ${said.figures.map((figure) => `$${figure}`).join(', ') || 'no figure at all'}.\n` +
      '    The waiver says the CLI is wrong about this one, so the page is what it is checked against.',
  )
}

if (unreachable.length > 0) {
  const message = `catalog prices: ${unreachable.length} waived entr${unreachable.length === 1 ? 'y' : 'ies'} could not be read from fal's own page`
  for (const line of unreachable) console.warn(`  - ${line}`)
  if (strict) {
    console.error(`${message}. CATALOG_STRICT is on, so this is a failure.`)
    process.exit(1)
  }
  console.warn(`${message}. Passing; set CATALOG_STRICT=1 to make this fail.`)
}

if (problems.length === 0 && verified > 0) {
  console.log(`  ${verified} of them waive the CLI and were read from fal's own page instead`)
}

if (problems.length > 0) {
  console.error(`\ncatalog prices: ${problems.length} disagree with genmedia\n`)
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('')
  process.exit(1)
}
console.log(`catalog prices: ${entries.length} entries agree with genmedia`)
