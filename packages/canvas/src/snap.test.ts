import { describe, expect, it } from 'vitest'
import { lockAxis, snapTo } from './snap.ts'

const rect = (x: number, y: number, width = 100, height = 100) => ({ x, y, width, height })

describe('snapTo', () => {
  const target = rect(0, 0)

  it('leaves a rectangle alone when nothing is near it', () => {
    const { position, guides } = snapTo(rect(500, 500), [target], 8)
    expect(position).toEqual({ x: 500, y: 500 })
    expect(guides).toEqual([])
  })

  it('pulls a near-miss onto the shared edge', () => {
    const { position } = snapTo(rect(3, 200), [target], 8)
    expect(position).toEqual({ x: 0, y: 200 })
  })

  it('lines up centres, not only edges', () => {
    /*
     * A narrower rectangle, so centre-to-centre is the only alignment in range:
     * at the same width its own left edge reaches the target's centre first and
     * that is the nearer snap, which is correct and proves nothing about
     * centres.
     */
    const narrow = rect(28, 300, 40, 40)
    const { position, guides } = snapTo(narrow, [target], 8)
    expect(position.x).toBe(30)
    expect(guides[0]).toMatchObject({ axis: 'x', at: 50 })
  })

  it('prefers the nearest alignment, even when a different kind is also in range', () => {
    // Left edge is 3 from the target's centre; the centres are 47 apart.
    expect(snapTo(rect(47, 300), [target], 8).position.x).toBe(50)
  })

  it('places one rectangle against the far edge of another', () => {
    // Left edge at 104, target's right edge at 100: the way two things get put
    // next to each other rather than on top of one another.
    const { position } = snapTo(rect(104, 0), [target], 8)
    expect(position.x).toBe(100)
  })

  it('decides each axis on its own', () => {
    const other = rect(400, 3)
    const { position, guides } = snapTo(rect(2, 0), [target, other], 8)
    expect(position).toEqual({ x: 0, y: 0 })
    expect(guides.map((guide) => guide.axis).sort()).toEqual(['x', 'y'])
  })

  it('takes the nearest of two candidates', () => {
    const { position } = snapTo(rect(6, 500), [target, rect(10, 500)], 8)
    expect(position.x).toBe(10)
  })

  it('draws a guide covering both rectangles', () => {
    const [guide] = snapTo(rect(2, 300), [target], 8).guides
    expect(guide).toMatchObject({ axis: 'x', at: 0, from: 0, to: 400 })
  })

  it('does nothing at all with no tolerance, which is how snapping is turned off', () => {
    const { position, guides } = snapTo(rect(1, 1), [target], 0)
    expect(position).toEqual({ x: 1, y: 1 })
    expect(guides).toEqual([])
  })
})

describe('lockAxis', () => {
  const origin = { x: 100, y: 100 }

  it('keeps the direction that has travelled further', () => {
    expect(lockAxis(origin, { x: 180, y: 110 })).toEqual({ x: 180, y: 100 })
    expect(lockAxis(origin, { x: 110, y: 180 })).toEqual({ x: 100, y: 180 })
  })

  it('follows a change of mind rather than the first few pixels', () => {
    // Shift held the whole way: a wobble at the start must not decide the drag.
    expect(lockAxis(origin, { x: 105, y: 40 })).toEqual({ x: 100, y: 40 })
  })
})
