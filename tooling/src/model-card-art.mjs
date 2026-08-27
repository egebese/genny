/**
 * The art behind a model card, generated once and committed.
 *
 * Two stages, because seventeen images from one prompt still come back looking
 * like seventeen different products. The first generates a single style key; the
 * rest are generated with `krea-2/turbo/style` pointing at it, so they share a
 * palette and a rendering without anyone having to describe one in words
 * seventeen times.
 *
 * Costs money, which is why it lives behind `--art` and its output is committed:
 * nobody should have to spend anything to build this repo.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const KEY = process.env.FAL_KEY
const SIZE = { width: 900, height: 600 }

/**
 * One sentence, and the only place the look is decided.
 *
 * Abstract on purpose: a card is furniture behind a logo, and a picture of
 * anything recognisable competes with the mark sitting on top of it.
 */
const STYLE_KEY =
  'abstract soft-focus gradient field, deep near-black background, one luminous ' +
  'ribbon of light curving through the frame, subtle film grain, no text, no ' +
  'objects, no people, cinematic studio lighting, generous empty space'

/** What varies per card. Hue only, so the grid reads by modality at a glance. */
const HUES = {
  image: 'violet and soft magenta light',
  video: 'cyan and deep blue light',
  audio: 'lime and warm amber light',
}

async function fal(endpoint, input) {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: 'POST',
    headers: { authorization: `Key ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(
      `${endpoint} answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
    )
  }
  const body = await response.json()
  const url = body.images?.[0]?.url
  if (!url) throw new Error(`${endpoint} returned no image`)
  return url
}

async function download(url, path) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`could not fetch ${url}: ${response.status}`)
  writeFileSync(path, Buffer.from(await response.arrayBuffer()))
}

export async function generateArt({ entries, artRoot, slugOf, keyDir }) {
  if (!KEY) throw new Error('FAL_KEY is required for --art')
  mkdirSync(artRoot, { recursive: true })
  mkdirSync(keyDir, { recursive: true })

  /*
   * Kept, and kept out of `public/`. It is the only reason a rerun produces the
   * same seventeen cards rather than a new set, and it is a source input rather
   * than something the app serves.
   */
  const keyPath = join(keyDir, 'style-key.png')
  if (!existsSync(keyPath)) {
    console.warn('generating the style key')
    await download(
      await fal('fal-ai/krea-2/turbo', {
        prompt: `${STYLE_KEY}, ${HUES.image}`,
        image_size: SIZE,
        num_images: 1,
        seed: 7,
      }),
      keyPath,
    )
  }
  const styleUrl = await uploadKey(keyPath)

  for (const { model } of entries) {
    const slug = slugOf(model.endpointId)
    const target = join(artRoot, `${slug}.webp`)
    if (existsSync(target)) continue

    console.warn(`generating art for ${model.endpointId}`)
    const url = await fal('fal-ai/krea-2/turbo/style', {
      prompt: `${STYLE_KEY}, ${HUES[model.modality] ?? HUES.image}`,
      reference_image_urls: [styleUrl],
      image_size: SIZE,
      num_images: 1,
      output_format: 'jpeg',
      // Fixed, so rerunning this produces the same board rather than a new one.
      seed: 11,
    })
    const raw = `${target}.jpg`
    await download(url, raw)
    shrink(raw, target)
    rmSync(raw)
  }
}

/**
 * Down to card size and into the format the extension claims.
 *
 * fal returns 900x600 jpeg at about 300KB, and seventeen of those is five
 * megabytes committed to serve thumbnails drawn 270px wide. This is a backdrop
 * behind a logo; nobody is going to look at its grain.
 */
function shrink(from, to) {
  execFileSync('cwebp', ['-quiet', '-q', '72', '-resize', '480', '0', from, '-o', to])
}

/** fal cannot fetch a local file, so the style key goes to its own storage. */
async function uploadKey(path) {
  const initiate = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: { authorization: `Key ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ content_type: 'image/png', file_name: 'style-key.png' }),
  })
  if (!initiate.ok) throw new Error(`upload initiate failed: ${initiate.status}`)
  const { upload_url, file_url } = await initiate.json()

  const put = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: readFileSync(path),
  })
  if (!put.ok) throw new Error(`upload failed: ${put.status}`)
  return file_url
}
