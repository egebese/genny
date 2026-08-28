import { describe, expect, it } from 'vitest'
import { EVERY, isDue } from './memory.ts'

describe('isDue', () => {
  it('says nothing about a board with too little on it', () => {
    expect(isDue(0, null)).toBe(false)
    expect(isDue(EVERY - 1, null)).toBe(false)
  })

  it('reads a board the first time it reaches ten', () => {
    expect(isDue(EVERY, null)).toBe(true)
  })

  it('does not read the same ten twice', () => {
    // The eleventh through the nineteenth node are all still the first block.
    expect(isDue(11, 10)).toBe(false)
    expect(isDue(19, 10)).toBe(false)
  })

  it('reads again at the next ten', () => {
    expect(isDue(20, 10)).toBe(true)
    expect(isDue(30, 20)).toBe(true)
  })

  it('catches up when several arrived between readings', () => {
    // Four generations of four outputs land at once. One reading, not four.
    expect(isDue(36, 10)).toBe(true)
    expect(isDue(37, 36)).toBe(false)
  })

  it('never reads backwards, since deleting nodes is not new work', () => {
    expect(isDue(12, 30)).toBe(false)
  })
})
