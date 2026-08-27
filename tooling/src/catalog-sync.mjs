#!/usr/bin/env node
/**
 * Compares every catalog file against what fal publishes right now.
 *
 * Metadata (title, description, thumbnail, category, deprecation) is refreshed
 * automatically: getting it wrong is cosmetic.
 *
 * Price is never written automatically. fal publishes it as prose
 * ("Your request will cost **$0.08** per image..."), often with conditions
 * attached, and a parser that is right nine times out of ten is worse than no
 * parser when the tenth silently changes what every generation costs. So a price
 * difference is reported, loudly, for a human to resolve.
 *
 *   node tooling/src/catalog-sync.mjs           refresh metadata, report prices
 *   node tooling/src/catalog-sync.mjs --check   report only, exit 1 on drift
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const catalogRoot = join(dirname(fileURLToPath(import.meta.url)), '../../packages/models/catalog')
const checkOnly = process.argv.includes('--check')

const drift = []
let refreshed = 0

for (const modality of readdirSync(catalogRoot)) {
  for (const file of readdirSync(join(catalogRoot, modality))) {
    if (!file.endsWith('.json')) continue
    const path = join(catalogRoot, modality, file)
    const entry = JSON.parse(readFileSync(path, 'utf8'))
    const remote = await fetchModel(entry.endpointId)

    if (!remote) {
      /*
       * Not proof it is gone. fal's model search does not index every endpoint:
       * elevenlabs/tts/multilingual-v2 answers generations fine and is absent
       * from this listing. So this reports rather than advises.
       */
      drift.push(
        `${entry.endpointId}: not in fal's model search. It may be unlisted rather than removed, so check it with a real call before disabling it.`,
      )
      continue
    }
    if (remote.deprecated || remote.removed) {
      drift.push(`${entry.endpointId}: fal marks this deprecated. Disable it in the admin panel.`)
    }

    const priceNote = comparePrice(entry, remote)
    if (priceNote) {
      const ours = entry.pricing?.note
      drift.push(ours ? `${priceNote}\n    catalog note: ${ours}` : priceNote)
    }

    /*
     * Description and thumbnail follow fal; the display name does not. fal's
     * titles are not written to sit in a picker together, and two of them
     * collided on "Nano Banana 2", which is a name that tells nobody which
     * model they are about to spend money on. The name in the catalog is ours.
     */
    const updated = { ...entry }
    if (remote.shortDescription) updated.description = remote.shortDescription.trim()
    /*
     * The thumbnail is ours now, drawn by `pnpm cards` from the provider mark and
     * the entry's own fields. Taking fal's back would undo that on every sync.
     */

    const next = `${JSON.stringify(updated, null, 2)}\n`
    if (!checkOnly && next !== readFileSync(path, 'utf8')) {
      writeFileSync(path, next)
      refreshed++
    }
  }
}

console.warn(`catalog: ${refreshed} file(s) refreshed`)

if (drift.length > 0) {
  console.error(`\n${drift.length} thing(s) need a human:\n`)
  for (const item of drift) console.error(`  - ${item}`)
  console.error('\nPrices are never changed automatically. Edit the file yourself.\n')
  process.exit(1)
}
console.warn('catalog: no price drift')

// ---------------------------------------------------------------------------
async function fetchModel(endpointId) {
  const url = `https://fal.ai/api/models?per_page=40&keywords=${encodeURIComponent(endpointId)}`
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`fal model list failed: ${response.status}`)
  const body = await response.json()
  return (body.items ?? []).find((item) => item.id === endpointId) ?? null
}

/**
 * Pulls the first dollar figure out of fal's pricing prose and compares it. A
 * match is reassurance, not proof: the prose often carries multipliers for
 * higher resolutions that no single number captures.
 */
function comparePrice(entry, remote) {
  const prose = remote.pricingInfoOverride
  if (!prose) return null
  const match = /\$([0-9]+(?:\.[0-9]+)?)/.exec(prose)
  if (!match) return null

  const published = Number(match[1])
  const ours = entry.pricing.unitPriceUsd
  if (Math.abs(published - ours) < 1e-9) return null

  const direction = published > ours ? 'UP' : 'DOWN'
  return `${entry.endpointId}: price moved ${direction}, catalog says $${ours}, fal says $${published}. fal's note: "${prose.slice(0, 160)}..."`
}
