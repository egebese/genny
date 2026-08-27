import { describe, expect, it } from 'vitest'
import { anchorPanel } from './anchor.ts'

const panel = { width: 320, height: 400 }
const bounds = { width: 1200, height: 800 }

describe('anchorPanel', () => {
  it('sits to the right of the node when there is room', () => {
    expect(anchorPanel({ x: 100, y: 200, width: 360, height: 360 }, panel, bounds)).toEqual({
      x: 472,
      y: 200,
    })
  })

  it('flips to the left when the right would overflow', () => {
    expect(anchorPanel({ x: 900, y: 100, width: 260, height: 200 }, panel, bounds)).toEqual({
      x: 568,
      y: 100,
    })
  })

  it('pins inside the viewport when neither side fits', () => {
    const narrow = { width: 400, height: 800 }
    const placed = anchorPanel({ x: 40, y: 10, width: 320, height: 200 }, panel, narrow)
    expect(placed.x).toBeGreaterThanOrEqual(12)
    expect(placed.x + panel.width).toBeLessThanOrEqual(narrow.width)
  })

  it('keeps the panel on screen for a node near the bottom', () => {
    const placed = anchorPanel({ x: 100, y: 760, width: 200, height: 200 }, panel, bounds)
    expect(placed.y + panel.height).toBeLessThanOrEqual(bounds.height)
  })

  it('prefers the top edge over a negative offset when the panel is taller than the viewport', () => {
    const short = { width: 1200, height: 300 }
    expect(anchorPanel({ x: 100, y: 50, width: 200, height: 200 }, panel, short).y).toBe(12)
  })
})
