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
      drift.push(`${entry.endpointId}: not found on fal any more. Disable it or remove it.`)
      continue
    }
    if (remote.deprecated || remote.removed) {
      drift.push(`${entry.endpointId}: fal marks this deprecated. Disable it in the admin panel.`)
    }

    const priceNote = comparePrice(entry, remote)
    if (priceNote) drift.push(priceNote)

    const updated = { ...entry }
    if (remote.title) updated.displayName = remote.title
    if (remote.shortDescription) updated.description = remote.shortDescription.trim()
    if (remote.thumbnailUrl) updated.thumbnailUrl = remote.thumbnailUrl

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
