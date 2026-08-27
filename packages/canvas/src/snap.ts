import type { Point, Rect } from './geometry.ts'

export type Guide = {
  axis: 'x' | 'y'
  /** Canvas coordinate of the line. */
  at: number
  /** How far the line runs along the other axis, covering both rectangles. */
  from: number
  to: number
}

export type Snapped = { position: Point; guides: Guide[] }

/** The three places a rectangle can line up with another, on one axis. */
function edges(rect: Rect, axis: 'x' | 'y'): [number, number, number] {
  const start = axis === 'x' ? rect.x : rect.y
  const size = axis === 'x' ? rect.width : rect.height
  return [start, start + size / 2, start + size]
}

function span(a: Rect, b: Rect, axis: 'x' | 'y'): { from: number; to: number } {
  const [aStart, aEnd] = axis === 'x' ? [a.y, a.y + a.height] : [a.x, a.x + a.width]
  const [bStart, bEnd] = axis === 'x' ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
  return { from: Math.min(aStart, bStart), to: Math.max(aEnd, bEnd) }
}

/**
 * The nearest alignment on one axis, or nothing.
 *
 * Every edge against every edge, not only like against like: a left edge
 * meeting another node's right edge is how two things get placed against each
 * other, and it is the alignment people reach for most after centre.
 */
type Match = { delta: number; at: number; other: Rect }

function nearest(
  moving: Rect,
  others: readonly Rect[],
  axis: 'x' | 'y',
  tolerance: number,
): Match | null {
  const mine = edges(moving, axis)
  let best: Match | null = null

  for (const other of others) {
    for (const theirs of edges(other, axis)) {
      // Where the line goes is the edge that matched, not where the node
      // started: two nodes agreeing on a centre draw one line down it.
      const candidate = closest(mine, theirs, other, tolerance)
      if (candidate && (!best || Math.abs(candidate.delta) < Math.abs(best.delta))) {
        best = candidate
      }
    }
  }
  return best
}

function closest(
  mine: readonly number[],
  theirs: number,
  other: Rect,
  tolerance: number,
): Match | null {
  let best: Match | null = null
  for (const ours of mine) {
    const delta = theirs - ours
    if (Math.abs(delta) > tolerance) continue
    if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, at: theirs, other }
  }
  return best
}

/**
 * Where a dragged rectangle should actually land.
 *
 * Tolerance is in canvas units, so the caller divides its pixel threshold by the
 * zoom: a snap that got easier as you zoomed out would fight the person trying
 * to place something roughly.
 *
 * Each axis is decided on its own. A node can be centred horizontally on one
 * neighbour and share a top edge with a different one, which is two guides and
 * one position.
 */
export function snapTo(moving: Rect, others: readonly Rect[], tolerance: number): Snapped {
  if (tolerance <= 0 || others.length === 0) {
    return { position: { x: moving.x, y: moving.y }, guides: [] }
  }

  const horizontal = nearest(moving, others, 'x', tolerance)
  const vertical = nearest(moving, others, 'y', tolerance)

  const position = {
    x: moving.x + (horizontal?.delta ?? 0),
    y: moving.y + (vertical?.delta ?? 0),
  }
  const settled = { ...position, width: moving.width, height: moving.height }

  const guides: Guide[] = []
  if (horizontal) {
    guides.push({ axis: 'x', at: horizontal.at, ...span(settled, horizontal.other, 'x') })
  }
  if (vertical) {
    guides.push({ axis: 'y', at: vertical.at, ...span(settled, vertical.other, 'y') })
  }
  return { position, guides }
}

/**
 * The drag, flattened to whichever direction it committed to.
 *
 * Held shift means "along this line": comparing the two distances rather than
 * asking which was first is what lets someone correct a wobble at the start of
 * a drag instead of being locked to it.
 */
export function lockAxis(origin: Point, moved: Point): Point {
  return Math.abs(moved.x - origin.x) >= Math.abs(moved.y - origin.y)
    ? { x: moved.x, y: origin.y }
    : { x: origin.x, y: moved.y }
}
