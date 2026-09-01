import { describe, expect, it } from 'vitest'
import { probeSize, resizeTo } from './resize.ts'
import {
  isThumbWidth,
  sourceFor,
  THUMB_WIDTHS,
  thumbKeyFor,
  thumbWidth,
  widthForDisplay,
} from './thumbnail.ts'

/** A 4000 pixel square, which is the order of size a generated picture is. */
async function huge(): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default
  const out = await sharp({
    create: { width: 4000, height: 4000, channels: 3, background: '#4a2f8f' },
  })
    .png()
    .toBuffer()
  return new Uint8Array(out)
}

describe('the copy the board draws', () => {
  it('serves only the widths it stores', () => {
    expect(isThumbWidth('1024')).toBe(true)
    expect(isThumbWidth(1024)).toBe(true)
    // The width comes out of a url anybody can edit, and each value is another
    // file to keep and another resize to pay for.
    expect(isThumbWidth('4096')).toBe(false)
    expect(isThumbWidth('../etc')).toBe(false)
    expect(() => thumbWidth('4096')).toThrow()
  })

  it('gives every width its own key, derived from the original', () => {
    // Derived rather than recorded: a flag saying "this asset has a thumbnail"
    // is set by the first size and then lies about the second, which is how
    // 512 quietly served an eighteen megabyte png.
    const keys = THUMB_WIDTHS.map((width) => thumbKeyFor('u/a/b.png', width))
    expect(new Set(keys).size).toBe(THUMB_WIDTHS.length)
    expect(keys).toContain('u/a/b.png.w1024.webp')
  })

  it('is the width asked for, and a fraction of the bytes', async () => {
    const original = await huge()
    const small = await resizeTo(original, 1024)
    expect(small.length).toBeLessThan(original.length / 20)

    const sharp = (await import('sharp')).default
    const meta = await sharp(small).metadata()
    expect(meta.width).toBe(1024)
    expect(meta.format).toBe('webp')
  })

  it('leaves a picture that is already small alone rather than blowing it up', async () => {
    const sharp = (await import('sharp')).default
    const tiny = new Uint8Array(
      await sharp({ create: { width: 200, height: 200, channels: 3, background: '#000' } })
        .png()
        .toBuffer(),
    )
    const meta = await sharp(await resizeTo(tiny, 1024)).metadata()
    expect(meta.width).toBe(200)
  })
})

describe('which copy a node is drawn from', () => {
  it('covers the node at the size it is actually shown', () => {
    // A board at rest: a 360 unit node on a retina screen wants 720 real pixels.
    expect(sourceFor('/a.png', 360, 2)).toBe('/a.png?w=1024')
    expect(sourceFor('/a.png', 360, 1)).toBe('/a.png?w=512')
  })

  it('asks for more as you zoom in', () => {
    expect(sourceFor('/a.png', 360 * 2, 2)).toBe('/a.png?w=2048')
  })

  it('gives the original once no stored copy is big enough', () => {
    // Looking at it closely is the case where the real file is what is wanted.
    expect(sourceFor('/a.png', 360 * 4, 2)).toBe('/a.png')
    expect(widthForDisplay(4000, 1)).toBeNull()
  })

  it('never draws a node from something smaller than itself', () => {
    for (const shown of [100, 359, 360, 700, 1000, 1500, 2000]) {
      const width = widthForDisplay(shown, 2)
      if (width !== null) expect(width).toBeGreaterThanOrEqual(shown * 2)
    }
  })
})

describe('probeSize', () => {
  it('reads the real dimensions of a picture', async () => {
    const sharp = (await import('sharp')).default
    const wide = new Uint8Array(
      await sharp({ create: { width: 640, height: 360, channels: 3, background: '#000' } })
        .png()
        .toBuffer(),
    )
    expect(await probeSize(wide)).toEqual({ width: 640, height: 360 })
  })

  /*
   * The one that has to be right. These columns exist so a node can be drawn at
   * the shape of the picture, and a portrait photograph stored as landscape
   * pixels with an EXIF quarter turn would be drawn on its side.
   */
  it('reports what will be seen, not what is stored, for a rotated photograph', async () => {
    const sharp = (await import('sharp')).default
    const turned = new Uint8Array(
      await sharp({ create: { width: 640, height: 360, channels: 3, background: '#000' } })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer(),
    )
    expect(await probeSize(turned)).toEqual({ width: 360, height: 640 })
  })

  it('gives up quietly on something it cannot parse', async () => {
    expect(await probeSize(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})
