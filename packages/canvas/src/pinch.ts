import type { Point, Viewport } from './geometry.ts'
import { zoomAt } from './geometry.ts'

/**
 * Where a two-finger gesture leaves the board.
 *
 * A pinch is a zoom and a pan at once: the fingers spread, and the midpoint
 * between them also travels. Both come out of one function so they cannot drift
 * apart, which is what makes the board feel stuck to the fingers.
 *
 * Recomputed from `base` every frame rather than applied incrementally.
 * Incremental would accumulate float error over a long pinch and would also
 * mean the gesture could never be exactly undone by pinching back.
 *
 * All points are surface-local, taken once at gesture start, the same
 * convention the wheel handler uses.
 */
export function pinchViewport(base: Viewport, from: Point, to: Point, factor: number): Viewport {
  const zoomed = zoomAt(base, from, factor)
  return { ...zoomed, x: zoomed.x + (to.x - from.x), y: zoomed.y + (to.y - from.y) }
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
