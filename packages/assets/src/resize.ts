import sharp from 'sharp'
import type { ThumbWidth } from './thumbnail.ts'

/**
 * A board-sized copy of a picture.
 *
 * A node is three hundred and sixty pixels across and the pictures behind them
 * are not: a canvas of thirty-one generations was two hundred and twenty-seven
 * megabytes of image, every one of them decoded to a full bitmap and
 * re-rastered on every zoom. That is what made the board feel slow, and no
 * amount of work on the transform could have fixed it.
 *
 * webp because it is a third the size of the png at a quality nobody can see
 * the difference of at this scale, and `withoutEnlargement` because a picture
 * already smaller than the target should be left alone rather than blown up
 * into a bigger file than the original.
 */
export async function resizeTo(bytes: Uint8Array, width: ThumbWidth): Promise<Uint8Array> {
  const out = await sharp(bytes)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
  return new Uint8Array(out)
}
