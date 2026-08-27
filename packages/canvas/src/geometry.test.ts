import { describe, expect, it } from 'vitest'
import {
  fitTo,
  MAX_ZOOM,
  MIN_ZOOM,
  rectBetween,
  toCanvas,
  toScreen,
  visibleRect,
  zoomAt,
} from './geometry.ts'

describe('coordinate conversion', () => {
  const viewport = { x: 100, y: 50, zoom: 2 }

  it('round trips a point', () => {
    const point = { x: 37, y: -12 }
    expect(toCanvas(toScreen(point, viewport), viewport)).toEqual(point)
  })

  it('places the canvas origin at the pan offset', () => {
    expect(toScreen({ x: 0, y: 0 }, viewport)).toEqual({ x: 100, y: 50 })
  })
})

describe('zoomAt', () => {
  it('keeps the canvas point under the cursor', () => {
    const viewport = { x: 0, y: 0, zoom: 1 }
    const cursor = { x: 300, y: 200 }
    const before = toCanvas(cursor, viewport)
    const after = toCanvas(cursor, zoomAt(viewport, cursor, 1.8))
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('clamps rather than letting zoom run away', () => {
    const viewport = { x: 0, y: 0, zoom: 1 }
    expect(zoomAt(viewport, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(viewport, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM)
  })

  it('holds the cursor point even at the clamp', () => {
    const viewport = { x: 0, y: 0, zoom: MAX_ZOOM }
    const cursor = { x: 120, y: 80 }
    expect(zoomAt(viewport, cursor, 4)).toEqual(viewport)
  })
})

describe('fitTo', () => {
  const size = { width: 1000, height: 800 }

  it('centres the content', () => {
    const rect = { x: 0, y: 0, width: 400, height: 400 }
    const viewport = fitTo([rect], size, 0)
    const centre = toScreen({ x: 200, y: 200 }, viewport)
    expect(centre).toEqual({ x: 500, y: 400 })
  })

  it('does not zoom in past 1:1 for a small board', () => {
    expect(fitTo([{ x: 0, y: 0, width: 10, height: 10 }], size).zoom).toBe(1)
  })

  it('zooms out to hold a board bigger than the screen', () => {
    expect(fitTo([{ x: 0, y: 0, width: 4000, height: 400 }], size, 0).zoom).toBeCloseTo(0.25)
  })

  it('falls back to the origin when there is nothing to frame', () => {
    expect(fitTo([], size)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('visibleRect', () => {
  it('grows as you zoom out', () => {
    const wide = visibleRect({ x: 0, y: 0, zoom: 0.5 }, { width: 800, height: 600 })
    expect(wide).toEqual({ x: 0, y: 0, width: 1600, height: 1200 })
  })
})

describe('rectBetween', () => {
  it('is the same rectangle whichever corner the drag started from', () => {
    const a = { x: 10, y: 20 }
    const b = { x: 60, y: 5 }
    const expected = { x: 10, y: 5, width: 50, height: 15 }
    expect(rectBetween(a, b)).toEqual(expected)
    expect(rectBetween(b, a)).toEqual(expected)
  })

  it('has no size for a click that never moved', () => {
    expect(rectBetween({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual({
      x: 4,
      y: 4,
      width: 0,
      height: 0,
    })
  })
})
