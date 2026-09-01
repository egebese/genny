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

/**
 * How big a picture is, before anything is done with it.
 *
 * `width` and `height` have been columns on `assets` since the first migration
 * and are threaded all the way through `NewAsset`, and nothing has ever written
 * them. The board reserves a rectangle from the model's declared aspect ratio
 * instead, which is right for a generation and a guess for an upload.
 *
 * Images only. Video and audio duration would mean ffprobe and a second binary
 * in the image for one number, so `duration_ms` stays null and the players read
 * it off the media element, where the browser already knows.
 *
 * Never throws: a file sharp cannot parse is still a file worth storing, and it
 * has already passed the byte sniffer by the time this runs.
 */
export async function probeSize(
  bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height, orientation } = await sharp(bytes).metadata()
    if (!width || !height) return null
    // EXIF orientations 5 to 8 are the quarter turns, where the stored pixels
    // are the other way round from what anyone will actually see.
    const turned = typeof orientation === 'number' && orientation >= 5
    return turned ? { width: height, height: width } : { width, height }
  } catch {
    return null
  }
}
