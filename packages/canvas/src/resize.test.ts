import { describe, expect, it } from 'vitest'
import { MAX_LONG_EDGE, MIN_LONG_EDGE, resizedByStep, resizedTo } from './resize.ts'

const landscape = { x: 100, y: 100, width: 360, height: 240 } // 3:2
const portrait = { x: 0, y: 0, width: 240, height: 360 } // 2:3

describe('resizedTo', () => {
  it('keeps the aspect, because the alternative is cropping nobody asked for', () => {
    const size = resizedTo(landscape, { x: 100 + 720, y: 100 + 60 })
    expect(size.width / size.height).toBeCloseTo(landscape.width / landscape.height, 5)
  })

  it('follows the axis the pointer actually moved on', () => {
    // Mostly sideways: the width is what the corner says.
    expect(resizedTo(landscape, { x: 100 + 720, y: 100 + 245 }).width).toBe(720)
    // Mostly down: the height is, and the width comes from the aspect.
    expect(resizedTo(landscape, { x: 100 + 361, y: 100 + 480 }).height).toBe(480)
  })

  it('works the same on a portrait node, where the long edge is the height', () => {
    const size = resizedTo(portrait, { x: 0, y: 720 })
    expect(size).toEqual({ width: 480, height: 720 })
  })

  it('stops shrinking before a node becomes a dot', () => {
    const size = resizedTo(landscape, { x: 100, y: 100 })
    expect(Math.max(size.width, size.height)).toBe(MIN_LONG_EDGE)
    expect(size.width / size.height).toBeCloseTo(1.5, 5)
  })

  it('stops growing before a node becomes the board', () => {
    const size = resizedTo(landscape, { x: 100_000, y: 100 })
    expect(Math.max(size.width, size.height)).toBe(MAX_LONG_EDGE)
  })

  it('survives a corner dragged past the node origin', () => {
    const size = resizedTo(landscape, { x: -5000, y: -5000 })
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })
})

describe('resizedByStep', () => {
  it('grows and shrinks by the same amount either way', () => {
    const bigger = resizedByStep(landscape, 1)
    const smaller = resizedByStep({ ...landscape, ...bigger }, -1)
    expect(smaller).toEqual({ width: landscape.width, height: landscape.height })
  })

  it('holds at the ends rather than refusing', () => {
    const tiny = { ...landscape, width: MIN_LONG_EDGE, height: Math.round(MIN_LONG_EDGE / 1.5) }
    expect(resizedByStep(tiny, -1).width).toBe(MIN_LONG_EDGE)

    const huge = { ...landscape, width: MAX_LONG_EDGE, height: Math.round(MAX_LONG_EDGE / 1.5) }
    expect(resizedByStep(huge, 1).width).toBe(MAX_LONG_EDGE)
  })
})
