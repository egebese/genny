import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM } from './geometry.ts'
import { distance, midpoint, pinchViewport } from './pinch.ts'

const base = { x: 0, y: 0, zoom: 1 }

describe('pinchViewport', () => {
  it('scales by the factor the fingers spread', () => {
    expect(pinchViewport(base, { x: 0, y: 0 }, { x: 0, y: 0 }, 2).zoom).toBe(2)
  })

  /* The point between the fingers is the one that must not move, or the board
   * slides out from under the gesture. */
  it('keeps the point between the fingers where it was', () => {
    const at = { x: 200, y: 100 }
    const after = pinchViewport(base, at, at, 2)
    const board = { x: (at.x - after.x) / after.zoom, y: (at.y - after.y) / after.zoom }
    expect(board.x).toBeCloseTo(at.x, 6)
    expect(board.y).toBeCloseTo(at.y, 6)
  })

  it('pans by however far the midpoint travelled', () => {
    const after = pinchViewport(base, { x: 100, y: 100 }, { x: 140, y: 90 }, 1)
    expect(after.x).toBe(40)
    expect(after.y).toBe(-10)
  })

  /*
   * Recomputed from the base every frame, so pinching out and back lands
   * exactly where it started rather than drifting by an accumulated rounding
   * error over a hundred frames.
   */
  it('is reversible, because it never compounds', () => {
    const out = pinchViewport(base, { x: 50, y: 50 }, { x: 50, y: 50 }, 3)
    const back = pinchViewport(base, { x: 50, y: 50 }, { x: 50, y: 50 }, 1)
    expect(back).toEqual(base)
    expect(out.zoom).toBe(3)
  })

  it('respects the same zoom rails as everything else', () => {
    expect(pinchViewport(base, { x: 0, y: 0 }, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM)
    expect(pinchViewport(base, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM)
  })
})

describe('midpoint and distance', () => {
  it('finds the middle of two fingers', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })

  it('measures how far apart they are', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
