import { overlaps, type Point, type Rect, type Size } from './geometry.ts'
import { NODE_GAP } from './placement.ts'

/** The dots are 32 apart, so everything landing on them lines up by default. */
export const GRID = 32

export function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

type Flow = {
  /** Everything already on the board, in canvas coordinates. */
  taken: readonly Rect[]
  /** What is on screen, in canvas coordinates. Sets the width of a row. */
  view: Rect
  /** The whole request, which is one row of nodes. */
  size: Size
}

/**
 * Where the next generation goes.
 *
 * Reading order. Work continues the row it is on until that row is as wide as
 * the screen, then starts a new one below, aligned to the same left edge.
 * Twenty generations lay out like twenty lines of text rather than like twenty
 * things dropped on a table, and everything lands on the grid the background
 * dots draw, so rows line up without anybody dragging them into line.
 *
 * This replaces sweeping right from the centre of the view for the first gap
 * that fit. That put the first generation in the middle, the second to its
 * right and the fourth off the side of the screen, and it started from the
 * middle again every time the board was panned, so two generations made half an
 * hour apart could land on top of each other's neighbours.
 *
 * Every node counts, not only the ones on screen. An earlier version consulted
 * the visible ones so the flow would follow the eye, and the moment work
 * scrolled off the bottom the flow could not see the row it was in the middle
 * of: six generations in a row put two of them in the same place. The board
 * moves to the new work instead, which is the half that was actually missing.
 */
export function placeInFlow({ taken, view, size }: Flow): Point {
  if (taken.length === 0) {
    return {
      x: snap(view.x + (view.width - size.width) / 2),
      y: snap(view.y + (view.height - size.height) / 2),
    }
  }

  const left = snap(taken.reduce((least, rect) => Math.min(least, rect.x), Infinity))
  const bottom = taken.reduce((low, rect) => Math.max(low, rect.y + rect.height), -Infinity)

  // The row being worked in is the lowest one, not the newest node. Newest is a
  // fact about time and rows are a fact about space, and after a drag the two
  // disagree.
  const row = taken.filter((rect) => rect.y + rect.height > bottom - 1)
  const rowTop = snap(Math.min(...row.map((rect) => rect.y)))
  const rowRight = Math.max(...row.map((rect) => rect.x + rect.width))

  const beside = { x: snap(rowRight + NODE_GAP), y: rowTop }
  const fitsBeside =
    beside.x + size.width <= left + view.width &&
    !taken.some((other) => overlaps({ ...beside, ...size }, other))
  if (fitsBeside) return beside

  return clearOf(taken, { x: left, y: snap(bottom + NODE_GAP) }, size)
}

/** Down past anything already there. Bounded: on a board dense enough to
 * exhaust this, overlapping beats hunting forever and the node can be dragged. */
function clearOf(taken: readonly Rect[], from: Point, size: Size): Point {
  let at = from
  for (let tries = 0; tries < 64; tries++) {
    const hit = taken.find((other) => overlaps({ ...at, ...size }, other))
    if (!hit) return at
    at = { x: at.x, y: snap(hit.y + hit.height + NODE_GAP) }
  }
  return at
}

/**
 * The smallest pan that brings `rect` fully on screen, or null if it already is.
 *
 * The board follows the work rather than the work staying where the board is
 * looking. Without this, a tidy reading order means the twentieth generation is
 * laid out perfectly somewhere nobody can see.
 *
 * The smallest pan and not a recentre: moving only as far as it has to keeps
 * the rest of the board where it was, and something arriving at the bottom of
 * the screen still reads as arriving next to what came before it.
 */
export function panToReveal(view: Rect, rect: Rect, padding = NODE_GAP): Point | null {
  /*
   * The rectangle decides whether to pan; the padding decides how far.
   *
   * Requiring the margin too meant a node flush against the left edge, fully
   * visible, still dragged the board sideways to show air beside it.
   */
  const shift = (start: number, span: number, viewStart: number, viewSpan: number): number => {
    // Bigger than the screen: line its start up, since the top left of
    // something is the half worth seeing.
    if (span + padding * 2 >= viewSpan) return start - padding - viewStart
    if (start < viewStart) return start - padding - viewStart
    if (start + span > viewStart + viewSpan) {
      return start + span + padding - (viewStart + viewSpan)
    }
    return 0
  }

  const by = {
    x: shift(rect.x, rect.width, view.x, view.width),
    y: shift(rect.y, rect.height, view.y, view.height),
  }
  return by.x === 0 && by.y === 0 ? null : by
}
