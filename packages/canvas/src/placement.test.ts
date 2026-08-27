import { describe, expect, it } from 'vitest'
import { NODE_GAP, NODE_LONG_EDGE, nodeSize, placeFree, siblingPosition } from './placement.ts'

describe('nodeSize', () => {
  it('gives portrait and landscape the same long edge', () => {
    expect(nodeSize({ width: 16, height: 9 })).toEqual({ width: 360, height: 203 })
    expect(nodeSize({ width: 9, height: 16 })).toEqual({ width: 203, height: 360 })
  })

  it('keeps a square square', () => {
    expect(nodeSize({ width: 1024, height: 1024 })).toEqual({ width: 360, height: 360 })
  })
})

describe('placeFree', () => {
  const size = { width: 100, height: 100 }

  it('uses the preferred spot when nothing is there', () => {
    expect(placeFree([], { x: 40, y: 40 }, size)).toEqual({ x: 40, y: 40 })
  })

  it('steps right past an occupied spot', () => {
    const taken = [{ x: 0, y: 0, width: 100, height: 100 }]
    expect(placeFree(taken, { x: 0, y: 0 }, size)).toEqual({ x: 124, y: 0 })
  })

  it('wraps to a new row once the row is full', () => {
    const taken = Array.from({ length: 8 }, (_, index) => ({
      x: index * (100 + NODE_GAP),
      y: 0,
      width: 100,
      height: 100,
    }))
    expect(placeFree(taken, { x: 0, y: 0 }, size)).toEqual({ x: 0, y: 124 })
  })

  it('ignores a rectangle that only touches the edge', () => {
    const taken = [{ x: 100, y: 0, width: 100, height: 100 }]
    expect(placeFree(taken, { x: 0, y: 0 }, size)).toEqual({ x: 0, y: 0 })
  })

  it('gives up and overlaps rather than hunting forever', () => {
    const taken = Array.from({ length: 64 }, (_, index) => ({
      x: (index % 8) * (100 + NODE_GAP),
      y: Math.floor(index / 8) * (100 + NODE_GAP),
      width: 100,
      height: 100,
    }))
    expect(placeFree(taken, { x: 0, y: 0 }, size)).toEqual({ x: 0, y: 0 })
  })
})

describe('siblingPosition', () => {
  it('lays siblings out in one row from the placeholder', () => {
    const anchor = { x: 10, y: 20, width: NODE_LONG_EDGE, height: 200 }
    expect(siblingPosition(anchor, 0)).toEqual({ x: 10, y: 20 })
    expect(siblingPosition(anchor, 2)).toEqual({ x: 10 + 2 * (NODE_LONG_EDGE + NODE_GAP), y: 20 })
  })
})
