import { overlaps, type Point, type Rect, type Size } from './geometry.ts'

/** Canvas units on a node's long edge. Everything else is derived from it. */
export const NODE_LONG_EDGE = 360
export const NODE_GAP = 24

/**
 * A node big enough to read at 1:1, in the aspect the output will have.
 *
 * Sized by the long edge rather than by area, so a 9:16 clip and a 16:9 clip sit
 * next to each other at the same visual weight instead of one dwarfing the other.
 */
export function nodeSize(aspect: Size): Size {
  const ratio = aspect.width / aspect.height
  return ratio >= 1
    ? { width: NODE_LONG_EDGE, height: Math.round(NODE_LONG_EDGE / ratio) }
    : { width: Math.round(NODE_LONG_EDGE * ratio), height: NODE_LONG_EDGE }
}

/**
 * The first free spot at or to the right of `preferred`.
 *
 * Sweeps right, then wraps to a new row, so a run of generations reads as a
 * row of siblings rather than a stack. Bounded: on a board dense enough to
 * exhaust the sweep, dropping the node at `preferred` and letting it overlap
 * beats hunting forever, and the person can drag it.
 */
export function placeFree(taken: Rect[], preferred: Point, size: Size): Point {
  const stepX = size.width + NODE_GAP
  const stepY = size.height + NODE_GAP
  const perRow = 8

  for (let attempt = 0; attempt < perRow * 8; attempt++) {
    const candidate = {
      x: preferred.x + (attempt % perRow) * stepX,
      y: preferred.y + Math.floor(attempt / perRow) * stepY,
    }
    const rect = { ...candidate, ...size }
    if (!taken.some((other) => overlaps(rect, other))) return candidate
  }
  return preferred
}

/**
 * Where the nth output of one generation goes, relative to the placeholder that
 * was reserved for the first.
 *
 * Deliberately not run through `placeFree`: siblings of one request belong in a
 * predictable row, and a sibling that dodged into a gap somewhere else would
 * break the only grouping the board has.
 */
export function siblingPosition(anchor: Rect, index: number): Point {
  return { x: anchor.x + index * (anchor.width + NODE_GAP), y: anchor.y }
}

/** Every rectangle one request will occupy, in output order. */
export function siblingRects(anchor: Rect, count: number): Rect[] {
  return Array.from({ length: count }, (_, index) => ({
    ...siblingPosition(anchor, index),
    width: anchor.width,
    height: anchor.height,
  }))
}

/**
 * The footprint a request of `count` outputs will occupy.
 *
 * A request for four has to reserve room for four before the first one lands.
 * Reserving one and letting the other three appear later means they land on top
 * of whatever was next to it, on a board the person may have arranged by hand.
 */
export function rowFootprint(size: Size, count: number): Size {
  return {
    width: size.width * count + NODE_GAP * (count - 1),
    height: size.height,
  }
}
