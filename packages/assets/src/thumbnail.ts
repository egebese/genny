import sharp from 'sharp'

/**
 * Widths the board and the library ask for. An allow-list rather than any
 * number, because the width is in a url anybody can edit and each new value is
 * another file to store and another resize to pay for.
 */
export const THUMB_WIDTHS = [512, 1024] as const

export type ThumbWidth = (typeof THUMB_WIDTHS)[number]

export function isThumbWidth(value: unknown): value is ThumbWidth {
  return THUMB_WIDTHS.some((width) => String(width) === String(value))
}

/** The allowed width this text names. Narrowed here rather than asserted at the
 * call site, which the repo does not allow and which would be a lie anyway. */
export function thumbWidth(value: string): ThumbWidth {
  const found = THUMB_WIDTHS.find((width) => String(width) === value)
  if (!found) throw new Error(`${value} is not a width we serve`)
  return found
}

/** Where a resized copy lives, derived from the original's key so it is found
 * again without a second column per size. */
export function thumbKeyFor(storageKey: string, width: ThumbWidth): string {
  return `${storageKey}.w${width}.webp`
}

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
