import { describe, expect, it } from 'vitest'
import { GRID, panToReveal, placeInFlow, showsAny, snap } from './flow.ts'
import { NODE_GAP } from './placement.ts'

const view = { x: 0, y: 0, width: 1280, height: 800 }
const size = { width: 320, height: 320 }
const at = (x: number, y: number) => ({ x, y, ...size })

describe('placeInFlow', () => {
  it('centres the first one in what they are looking at', () => {
    expect(placeInFlow({ taken: [], view, size })).toEqual({ x: snap(480), y: snap(240) })
  })

  it('puts the next one beside the last, on the same line', () => {
    const where = placeInFlow({ taken: [at(0, 0)], view, size })
    expect(where).toEqual({ x: snap(320 + NODE_GAP), y: 0 })
  })

  it('wraps to a new row when the line is as wide as the screen', () => {
    const row = [at(0, 0), at(352, 0), at(704, 0), at(1056, 0)]
    const where = placeInFlow({ taken: row, view, size })
    expect(where).toEqual({ x: 0, y: snap(320 + NODE_GAP) })
  })

  it('measures the row from the work, not from the left of the screen', () => {
    // Starting at 640, a 1280 wide row reaches 1920, so three fit before it wraps.
    const row = [at(640, 0), at(992, 0), at(1344, 0)]
    const where = placeInFlow({ taken: row, view, size })
    expect(where).toEqual({ x: 640, y: snap(320 + NODE_GAP) })
  })

  it('works from the lowest row rather than the newest node', () => {
    /*
     * Newest is a fact about time and rows are a fact about space. Something
     * generated first and then dragged to the bottom is where the work is now,
     * and putting the next one back up beside an older node reads as the board
     * losing its place.
     */
    const where = placeInFlow({ taken: [at(0, 0), at(0, 800)], view, size })
    expect(where).toEqual({ x: snap(320 + NODE_GAP), y: 800 })
  })

  it('counts work that is off screen, which is most of it after a while', () => {
    /*
     * An earlier version consulted only the visible nodes so the flow would
     * follow the eye. The moment work scrolled off the bottom it could not see
     * the row it was in the middle of, and six generations in a row put two of
     * them in the same place.
     */
    const offScreen = at(0, 4000)
    const where = placeInFlow({ taken: [at(0, 0), offScreen], view, size })
    expect(where).toEqual({ x: snap(320 + NODE_GAP), y: 4000 })
  })

  it('never lands on something hanging into the row from above', () => {
    const where = placeInFlow({ taken: [at(0, 0), { x: 352, y: -160, ...size }], view, size })
    expect(where).toEqual({ x: 0, y: snap(320 + NODE_GAP) })
  })

  it('lands on the grid, so rows line up without anybody dragging them', () => {
    const where = placeInFlow({ taken: [at(7, 13)], view, size })
    expect(where.x % GRID).toBe(0)
    expect(where.y % GRID).toBe(0)
  })
})

describe('panToReveal', () => {
  it('says nothing when the work is already on screen', () => {
    expect(panToReveal(view, at(100, 100))).toBeNull()
  })

  it('does not pan for the sake of the margin alone', () => {
    // Flush against the left edge and entirely visible. Requiring its margin
    // too dragged the board sideways to show air.
    expect(panToReveal(view, at(0, 100), 24)).toBeNull()
  })

  it('moves the smallest distance that brings it in, not to the middle', () => {
    const by = panToReveal(view, at(0, 500), 24)
    expect(by).toEqual({ x: 0, y: 500 + 320 + 24 - 800 })
  })

  it('brings back work that is above or to the left', () => {
    expect(panToReveal(view, at(-200, -100), 0)).toEqual({ x: -200, y: -100 })
  })

  it('lines up the start of something bigger than the screen', () => {
    const huge = { x: 40, y: 40, width: 4000, height: 4000 }
    expect(panToReveal(view, huge, 0)).toEqual({ x: 40, y: 40 })
  })
})

describe('opening a board where it was left', () => {
  const nodes = [{ x: 1111, y: 456, width: 360, height: 360 }]

  it('is fine when the saved position still shows the work', () => {
    expect(showsAny({ x: 1000, y: 400, width: 2690, height: 1400 }, nodes)).toBe(true)
  })

  it('is not, when it was left looking at empty space', () => {
    // A real board: saved at a pan of y -3427 and a zoom of 0.535, which puts
    // the screen three and a half thousand units below every node on it.
    expect(showsAny({ x: 1272, y: 6403, width: 2690, height: 1400 }, nodes)).toBe(false)
  })

  it('says nothing is shown when there is nothing to show', () => {
    expect(showsAny({ x: 0, y: 0, width: 100, height: 100 }, [])).toBe(false)
  })
})
