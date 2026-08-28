#!/usr/bin/env node
/**
 * A first draft of a catalog entry, from what fal publishes.
 *
 *   node tooling/src/catalog-draft.mjs minimax/h3/text-to-video [more...]
 *   node tooling/src/catalog-draft.mjs --from tooling/families/kling-v3.json
 *
 * A draft, not an entry. It fills in what is mechanical: every control with its
 * real bounds and options, every reference slot, and the price. It cannot fill
 * in what the model is for, which group it belongs in, or which of two
 * endpoints is the plainer task, and it guesses at slot roles from field names,
 * which is exactly the guess that cannot be made from a name: `image_url` is a
 * start frame on one endpoint and the thing being edited on another.
 *
 * So it writes `TODO` where a person has to decide, and `pnpm check` fails
 * until they have. Reading a hundred of these is still faster than writing a
 * hundred, and far more accurate than either: every bound comes from the
 * endpoint's own schema rather than from someone's reading of a docs page.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { priceProse } from './catalog-price-prose.mjs'
import { readSchema } from './catalog-schema.mjs'

const catalogRoot = join(dirname(fileURLToPath(import.meta.url)), '../../packages/models/catalog')

const args = process.argv.slice(2)
const from = args.indexOf('--from')
/*
 * The decisions a schema cannot make, written once per family instead of once
 * per file. A family is six endpoints that differ by a word, and editing six
 * near-identical JSON files by hand is how one of them ends up in the wrong
 * group with last week's price.
 */
const manifest = from === -1 ? null : JSON.parse(readFileSync(args[from + 1], 'utf8'))
const ids = manifest ? Object.keys(manifest.endpoints) : args

if (ids.length === 0) {
  console.error('usage: catalog-draft.mjs <endpointId>... | --from <manifest.json>')
  process.exit(1)
}

for (const endpointId of ids) {
  try {
    write(endpointId)
  } catch (error) {
    console.error(`  ${endpointId}: ${error.message}`)
  }
}

/** The manifest's own values, family defaults first and the endpoint's on top. */
function decided(endpointId) {
  if (!manifest) return {}
  const { endpoints, ...family } = manifest
  const own = endpoints[endpointId] ?? {}
  return {
    ...family,
    ...own,
    pricing: { ...family.pricing, ...own.pricing },
    family: family.family,
  }
}

function write(endpointId) {
  const doc = JSON.parse(
    execFileSync('genmedia', ['schema', endpointId, '--format=openapi'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
  const { inputs, references } = readSchema(doc, endpointId)
  const modality = modalityOf(doc, endpointId)
  const slug = endpointId.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  const path = join(catalogRoot, modality, `${slug}.json`)
  if (existsSync(path) && !args.includes('--overwrite')) {
    console.log(`  ${endpointId}: already in the catalog, left alone`)
    return
  }

  const said = decided(endpointId)
  const entry = {
    endpointId,
    family: said.family ?? { id: 'TODO', name: 'TODO' },
    modality,
    group: said.group ?? 'TODO',
    displayName: said.displayName ?? doc.info?.title ?? 'TODO',
    description: said.description ?? 'TODO',
    sortOrder: said.sortOrder ?? 0,
    pricing: {
      unit: 'TODO',
      unitPriceUsd: 0,
      ...said.pricing,
      note:
        said.pricing?.note ??
        priceProse(endpointId) ??
        'TODO: fal publishes no price prose for this endpoint.',
    },
    creditMultiplier: said.creditMultiplier ?? 1.25,
    promptField: inputs.some((input) => input.name === 'prompt')
      ? 'prompt'
      : inputs.some((input) => input.name === 'text')
        ? 'text'
        : null,
    inputs,
    references,
    capabilities: {
      supportsNegativePrompt: inputs.some((input) => input.name === 'negative_prompt'),
      supportsSeed: inputs.some((input) => input.name === 'seed'),
      maxOutputs: 1,
    },
    markUrl: said.markUrl ?? 'TODO',
  }
  /*
   * Roles are guessed from field names and the guess is often wrong, so the
   * manifest overrides them by field. Everything else about a slot comes from
   * the schema and is not worth repeating.
   */
  for (const slot of entry.references) {
    const override = said.roles?.[slot.field]
    if (override) Object.assign(slot, typeof override === 'string' ? { role: override } : override)
  }
  if (said.hidden) {
    for (const input of entry.inputs) if (said.hidden.includes(input.name)) input.hidden = true
  }
  if (said.drop) entry.inputs = entry.inputs.filter((input) => !said.drop.includes(input.name))
  /*
   * fal marks a field optional that the studio treats as the point of the
   * model. Kling declares `prompt` as `anyOf [string, null]` on every text to
   * video route; a text to video model with an optional prompt is a shape our
   * dock has no way to present, so the manifest says which are really required.
   */
  for (const input of entry.inputs) {
    if (said.require?.includes(input.name)) input.required = true
    // A required control fal ships no default for. The dock sends only what
    // was changed, so without one an untouched generation cannot validate.
    const chosen = said.defaults?.[input.name]
    if (chosen !== undefined) input.default = chosen
  }
  if (said.promptField !== undefined) entry.promptField = said.promptField

  writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`)
  console.log(`  ${endpointId} -> ${path.replace(`${catalogRoot}/`, '')}`)
}

/**
 * What comes out, from what the output schema holds.
 *
 * fal's `category` says `image-to-video` for a model that makes video and
 * `text-to-image` for one that makes stills, so the arrow points the wrong way
 * half the time; the output is the only side that answers the question asked.
 *
 * Found by name rather than through the path's 200 response, which is the queue
 * status on every fal endpoint and says nothing about the result.
 */
function modalityOf(doc, endpointId) {
  const schemas = doc.components?.schemas ?? {}
  const named = Object.keys(schemas).filter((key) => key.endsWith('Output'))
  const out = JSON.stringify(named.map((key) => schemas[key]))
  if (/"(video|videos)"/.test(out)) return 'video'
  if (/"(audio|audios|speech)"/.test(out)) return 'audio'
  return 'image'
}
