import { GRID, snap } from './flow.ts'
import type { Point, Rect } from './geometry.ts'

/**
 * How far a duplicate sits from what it came from.
 *
 * One grid step, so it reads as a second copy lying on top of the first rather
 * than as something that moved, and lands on the grid like everything else.
 */
export const NUDGE = GRID

/** What travels on the clipboard: a reference and a rectangle, nothing else. */
export type Clipping = Rect & { assetId: string }

/**
 * The block's own bounding box.
 *
 * A copy of four nodes is one shape, not four independent rectangles, and every
 * move below is applied to the shape so the arrangement survives the trip.
 */
export function spanOf(items: readonly Rect[]): Rect | null {
  const first = items[0]
  if (!first) return null
  const left = Math.min(...items.map((item) => item.x))
  const top = Math.min(...items.map((item) => item.y))
  return {
    x: left,
    y: top,
    width: Math.max(...items.map((item) => item.x + item.width)) - left,
    height: Math.max(...items.map((item) => item.y + item.height)) - top,
  }
}

/** Moves the whole block so its top left lands on `to`, snapped to the grid. */
export function movedTo<T extends Rect>(items: readonly T[], to: Point): T[] {
  const span = spanOf(items)
  if (!span) return []
  const by = { x: snap(to.x) - span.x, y: snap(to.y) - span.y }
  return items.map((item) => ({ ...item, x: item.x + by.x, y: item.y + by.y }))
}

/**
 * Moves the block so it sits in the middle of what is on screen.
 *
 * Where a paste goes when nobody pointed at anywhere: pressing the keys rather
 * than using the menu, or pasting onto a different board than the one it was
 * copied from, where the original coordinates mean nothing.
 */
export function centredIn<T extends Rect>(items: readonly T[], view: Rect): T[] {
  const span = spanOf(items)
  if (!span) return []
  return movedTo(items, {
    x: view.x + (view.width - span.width) / 2,
    y: view.y + (view.height - span.height) / 2,
  })
}

/** One step down and right, which is what a duplicate is. */
export function nudged<T extends Rect>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item, x: item.x + NUDGE, y: item.y + NUDGE }))
}
