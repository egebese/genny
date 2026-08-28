import { describe, expect, it } from 'vitest'
import { centredIn, movedTo, nudged, spanOf } from './clipboard.ts'

const block = [
  { assetId: 'a', x: 100, y: 100, width: 200, height: 200 },
  { assetId: 'b', x: 400, y: 300, width: 200, height: 100 },
]

describe('a clipping is a shape, not a list of rectangles', () => {
  it('spans from the leftmost edge to the rightmost', () => {
    expect(spanOf(block)).toEqual({ x: 100, y: 100, width: 500, height: 300 })
  })

  it('has no span when there is nothing on it', () => {
    expect(spanOf([])).toBeNull()
  })

  it('keeps the arrangement when it lands somewhere else', () => {
    const [first, second] = movedTo(block, { x: 0, y: 0 })
    expect(first).toMatchObject({ x: 0, y: 0 })
    expect(second).toMatchObject({ x: 300, y: 200 })
  })

  it('lands on the grid however untidy the target was', () => {
    expect(movedTo(block, { x: 37, y: 37 })[0]).toMatchObject({ x: 32, y: 32 })
  })

  it('centres the whole block, not its first member', () => {
    const view = { x: 0, y: 0, width: 1000, height: 700 }
    const span = spanOf(centredIn(block, view))
    // Snapping moves it by less than one grid step, which is the point of it.
    expect(span?.x).toBeCloseTo((1000 - 500) / 2, -2)
    expect(span?.y).toBeCloseTo((700 - 300) / 2, -2)
  })

  it('moves a duplicate off the original so both can be seen', () => {
    expect(nudged(block)[0]).toMatchObject({ x: 132, y: 132 })
  })

  it('carries the reference, since that is the whole payload', () => {
    expect(movedTo(block, { x: 0, y: 0 })[1]?.assetId).toBe('b')
  })
})
