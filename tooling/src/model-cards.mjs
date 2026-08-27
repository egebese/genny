#!/usr/bin/env node
/**
 * Draws a 3:2 card for every catalog entry.
 *
 * Generated rather than collected. fal's own thumbnails are a grab bag of
 * screenshots at different sizes, and a picker where each row looks like it came
 * from a different product is a picker you read instead of scan.
 *
 * The provider mark comes from @lobehub/icons-static-svg and is inlined, so the
 * card is one self-contained file: no runtime dependency, no second request, and
 * nothing to add to the CSP.
 *
 * The mark and the category, and no name. At the size the picker draws these,
 * text baked into the image is unreadable and duplicates the real text beside
 * it; the card carries what survives being 180px wide.
 *
 *   node tooling/src/model-cards.mjs           write every card
 *   node tooling/src/model-cards.mjs --check   fail if any card is missing or stale
 *
 * `pnpm check` runs the second one, so a model added without a card fails the
 * build rather than shipping a hole in the picker. The output directory is in
 * biome's ignore list: this is generated, and the mark inside each card is
 * decorative under the card's own aria-label.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const catalogRoot = join(root, 'packages/models/catalog')
const outRoot = join(root, 'apps/web/public/models')
// Resolved rather than joined onto node_modules: pnpm puts the real files under
// .pnpm and only symlinks them into the workspace that asked for them.
const iconRoot = join(
  dirname(createRequire(import.meta.url).resolve('@lobehub/icons-static-svg/package.json')),
  'icons',
)
const checkOnly = process.argv.includes('--check')

/**
 * Endpoint prefix to lobehub icon id. First match wins, so order longest first.
 *
 * By prefix rather than by an entry in each catalog file: fal names endpoints
 * after the lab that trained the model, so one rule covers every future
 * endpoint from the same lab and a new one only lands here when it is a lab we
 * have never seen.
 */
const PROVIDERS = [
  ['fal-ai/nano-banana', 'gemini'],
  ['fal-ai/elevenlabs', 'elevenlabs'],
  ['fal-ai/kling-video', 'kling'],
  ['fal-ai/ideogram', 'ideogram'],
  ['fal-ai/stable-audio', 'stability'],
  ['fal-ai/bytedance', 'bytedance'],
  ['fal-ai/flux', 'flux'],
  ['fal-ai/gemini', 'gemini'],
  ['fal-ai/veo', 'gemini'],
  ['fal-ai/wan', 'alibaba'],
  ['fal-ai/minimax', 'minimax'],
  ['fal-ai/luma', 'luma'],
  ['fal-ai/recraft', 'recraft'],
  ['fal-ai/topaz', 'topazlabs'],
  ['fal-ai/openai', 'openai'],
  ['fal-ai/gpt-image', 'openai'],
]

/** One hue per modality, so a glance at the grid separates stills from clips. */
const TINTS = {
  image: { from: '#1b1524', to: '#0b0b0f', mark: '#d0b7f9' },
  video: { from: '#101d24', to: '#0b0b0f', mark: '#99edff' },
  audio: { from: '#141f12', to: '#0b0b0f', mark: '#adff00' },
}

function iconFor(endpointId) {
  const match = PROVIDERS.find(([prefix]) => endpointId.startsWith(prefix))
  if (!match) return null
  const path = join(iconRoot, `${match[1]}.svg`)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/**
 * Strips the wrapper off a lobehub mark.
 *
 * They put `fill="currentColor"` on the outer `<svg>` and nothing on the paths,
 * so dropping that element leaves them inheriting from a cascade that does not
 * exist here and painting themselves black. The colour is reapplied on the
 * nested svg we emit instead. The title goes too: a screen reader reading
 * "Flux" out of a decorative mark is one label too many.
 */
function markBody(svg) {
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
  return { viewBox: /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24', inner }
}

const escapeXml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function card(model) {
  const tint = TINTS[model.modality] ?? TINTS.image
  const mark = iconFor(model.endpointId)
  const glyph = mark ? markBody(mark) : null

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" role="img" aria-label="${escapeXml(model.displayName)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint.from}"/>
      <stop offset="1" stop-color="${tint.to}"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="899" height="599" fill="none" stroke="#ffffff" stroke-opacity="0.10"/>
${
  glyph
    ? `  <svg x="330" y="180" width="240" height="240" viewBox="${glyph.viewBox}" fill="${tint.mark}">${glyph.inner}</svg>`
    : `  <circle cx="450" cy="300" r="96" fill="none" stroke="${tint.mark}" stroke-opacity="0.5" stroke-width="10"/>`
}
  <rect x="60" y="56" rx="26" height="52" width="${40 + model.group.length * 15}" fill="#ffffff" fill-opacity="0.08"/>
  <text x="80" y="90" font-family="ui-monospace, 'SF Mono', monospace" font-size="23" fill="${tint.mark}" letter-spacing="1.5">${escapeXml(model.group.toUpperCase())}</text>
</svg>
`
}

function slugOf(endpointId) {
  return endpointId
    .replace(/^fal-ai\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
}

mkdirSync(outRoot, { recursive: true })
const stale = []
let written = 0

for (const modality of readdirSync(catalogRoot)) {
  for (const file of readdirSync(join(catalogRoot, modality))) {
    if (!file.endsWith('.json')) continue
    const path = join(catalogRoot, modality, file)
    const model = JSON.parse(readFileSync(path, 'utf8'))
    const slug = slugOf(model.endpointId)
    const target = join(outRoot, `${slug}.svg`)
    const svg = card(model)

    const current = existsSync(target) ? readFileSync(target, 'utf8') : null
    if (current !== svg) {
      if (checkOnly) {
        stale.push(`${modality}/${file} -> public/models/${slug}.svg`)
      } else {
        writeFileSync(target, svg)
        written += 1
      }
    }

    const url = `/models/${slug}.svg`
    if (!checkOnly && model.thumbnailUrl !== url) {
      writeFileSync(path, `${JSON.stringify({ ...model, thumbnailUrl: url }, null, 2)}\n`)
    }
    if (!iconFor(model.endpointId)) {
      console.warn(`no provider mark for ${model.endpointId}; add a prefix to PROVIDERS`)
    }
  }
}

if (checkOnly && stale.length > 0) {
  console.error(`${stale.length} model card(s) out of date:\n  ${stale.join('\n  ')}`)
  console.error('Run: node tooling/src/model-cards.mjs')
  process.exit(1)
}
console.log(checkOnly ? 'model cards: up to date' : `model cards: ${written} written`)
