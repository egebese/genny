/**
 * Which copy of a picture to draw, and where it lives.
 *
 * Deliberately free of `sharp`. The board decides which copy it wants and the
 * board runs in a browser; importing the resizer here pulled `fs` and
 * `child_process` into the client bundle and the build stopped.
 */
/**
 * Widths the board and the library ask for.
 *
 * An allow-list rather than any number, because the width is in a url anybody
 * can edit and each new value is another file to store and another resize to
 * pay for. Three steps and then the original: a node drawn at four times its
 * size is being looked at closely, and at that point the real file is what
 * somebody wants.
 */
export const THUMB_WIDTHS = [512, 1024, 2048] as const

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
 * Which copy to draw a node from, given how big it is on screen right now.
 *
 * The smallest stored width that still covers it, and the original when none
 * does. A board sits at a zoom where a node is a few hundred pixels across and
 * a generated picture is several thousand, so drawing the original is tens of
 * megabytes decoded to show a thumbnail. Zoom in and the same node wants the
 * real thing, and gets it.
 *
 * Device pixels, not CSS pixels: a retina screen draws twice as many, and a
 * board that looked soft on one was the first thing anybody noticed.
 */
export function widthForDisplay(onScreenCssWidth: number, pixelRatio = 1): ThumbWidth | null {
  const needed = onScreenCssWidth * pixelRatio
  return THUMB_WIDTHS.find((width) => width >= needed) ?? null
}

/** The url to draw from. No parameter means the original, at full quality. */
export function sourceFor(url: string, onScreenCssWidth: number, pixelRatio = 1): string {
  const width = widthForDisplay(onScreenCssWidth, pixelRatio)
  return width === null ? url : `${url}?w=${width}`
}
