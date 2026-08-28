#!/usr/bin/env node
/**
 * The provider mark for every catalog entry, and optionally the art behind it.
 *
 * The card itself is composed in the browser rather than drawn here. It used to
 * be one generated SVG carrying the art, the mark, the badge and the name; every
 * tweak to the badge meant regenerating seventeen files, and text baked into an
 * image at 180px wide is unreadable anyway. Now this writes the two things that
 * cannot be CSS, and `model-card.tsx` arranges them.
 *
 *   node tooling/src/model-cards.mjs           write the marks
 *   node tooling/src/model-cards.mjs --check   fail if any mark is missing or stale
 *   node tooling/src/model-cards.mjs --art     also generate the art, which costs money
 *
 * `pnpm check` runs the second one, so a model from a lab we have no mark for
 * fails the build rather than shipping a hole in the picker. The output
 * directory is in biome's ignore list: it is generated.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { liftMark } from './mark-colour.mjs'
import { generateArt } from './model-card-art.mjs'
import { PROVIDERS } from './model-card-providers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const catalogRoot = join(root, 'packages/models/catalog')
const outRoot = join(root, 'apps/web/public/models')
const markRoot = join(outRoot, 'marks')
const artRoot = join(outRoot, 'art')
const styleRoot = join(root, 'tooling/style')
// Resolved rather than joined onto node_modules: pnpm puts the real files under
// .pnpm and only symlinks them into the workspace that asked for them.
const iconRoot = join(
  dirname(createRequire(import.meta.url).resolve('@lobehub/icons-static-svg/package.json')),
  'icons',
)

const checkOnly = process.argv.includes('--check')
const withArt = process.argv.includes('--art')

/**
 * The brand's own colours where lobehub has them, the mono mark where it does
 * not.
 *
 * Colour first, because these are logos people already know and a grid of marks
 * at one weight is read by shape alone.
 */
function iconFor(endpointId) {
  const match = PROVIDERS.find(([prefix]) => endpointId.startsWith(prefix))
  if (!match) return null

  const colour = join(iconRoot, `${match[1]}-color.svg`)
  if (existsSync(colour)) return { slug: match[1], svg: liftMark(readFileSync(colour, 'utf8')) }

  const mono = join(iconRoot, `${match[1]}.svg`)
  return existsSync(mono) ? { slug: match[1], svg: readFileSync(mono, 'utf8'), mono: true } : null
}

/**
 * Strips the wrapper off a lobehub mark.
 *
 * They put `fill="currentColor"` on the outer `<svg>` and nothing on the paths,
 * so dropping that element leaves them inheriting from a cascade that does not
 * exist and painting themselves black. The title goes too: a screen reader
 * reading "Flux" out of a decorative mark is one label too many.
 */
function markBody(svg) {
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
  return { viewBox: /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24', inner }
}

/** `--color-ink`. Baked in, because these load through an `<img>`. */
const MONO_INK = '#fafafa'

function markFile(endpointId) {
  const icon = iconFor(endpointId)
  if (!icon) return null
  const glyph = markBody(icon.svg)
  return {
    slug: icon.slug,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${glyph.viewBox}"${icon.mono ? ` fill="${MONO_INK}"` : ''} aria-hidden="true">${glyph.inner}</svg>\n`,
  }
}

function slugOf(endpointId) {
  return endpointId
    .replace(/^fal-ai\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
}

mkdirSync(markRoot, { recursive: true })
const stale = []
let written = 0

const entries = []
for (const modality of readdirSync(catalogRoot)) {
  for (const file of readdirSync(join(catalogRoot, modality))) {
    if (!file.endsWith('.json')) continue
    const path = join(catalogRoot, modality, file)
    entries.push({ path, model: JSON.parse(readFileSync(path, 'utf8')) })
  }
}

const missing = []

for (const { path, model } of entries) {
  const mark = markFile(model.endpointId)
  if (!mark) {
    /*
     * A warning here used to be the end of it, and the contract only asks that
     * `markUrl` be set rather than that it point at anything. So an entry could
     * name a file that was never written and ship a hole in the picker, which
     * is the one thing this script exists to prevent.
     */
    missing.push(`${model.endpointId}: no mark. Add a prefix to PROVIDERS, or drop the model.`)
    continue
  }

  const markPath = join(markRoot, `${mark.slug}.svg`)
  const current = existsSync(markPath) ? readFileSync(markPath, 'utf8') : null
  if (current !== mark.svg) {
    if (checkOnly) stale.push(`public/models/marks/${mark.slug}.svg`)
    else {
      writeFileSync(markPath, mark.svg)
      written += 1
    }
  }

  if (model.markUrl && model.markUrl !== `/models/marks/${mark.slug}.svg`) {
    missing.push(`${model.endpointId}: names ${model.markUrl}, which is not the mark for its lab.`)
  }

  const slug = slugOf(model.endpointId)
  const urls = {
    markUrl: `/models/marks/${mark.slug}.svg`,
    ...(existsSync(join(artRoot, `${slug}.webp`)) ? { artUrl: `/models/art/${slug}.webp` } : {}),
  }
  if (!checkOnly && (model.markUrl !== urls.markUrl || model.artUrl !== urls.artUrl)) {
    const { thumbnailUrl: _dropped, ...rest } = model
    writeFileSync(path, `${JSON.stringify({ ...rest, ...urls }, null, 2)}\n`)
  }
}

if (missing.length > 0) {
  console.error(`${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} would draw a hole:`)
  for (const line of missing) console.error(`  - ${line}`)
  process.exit(1)
}

if (checkOnly && stale.length > 0) {
  console.error(`${stale.length} provider mark(s) out of date:\n  ${stale.join('\n  ')}`)
  console.error('Run: node tooling/src/model-cards.mjs')
  process.exit(1)
}

if (withArt) {
  await generateArt({ entries, artRoot, slugOf, keyDir: styleRoot })
  console.log('art written; rerun without --art to pick up the new urls')
}

console.log(checkOnly ? 'model marks: up to date' : `model marks: ${written} file(s) written`)
