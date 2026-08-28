import { describe, expect, it } from 'vitest'
import { matches, type Searchable } from './search.ts'

const asset = (overrides: Partial<Searchable> = {}): Searchable => ({
  label: 'wet-slate-2',
  facts: {
    shortName: 'Red Leaf, Wet Slate',
    kind: 'scene',
    subject: 'A vibrant red leaf on a wet dark slate surface.',
    tags: ['autumn', 'macro', 'rain'],
    groupKey: 'red-leaf-wet-slate',
  },
  ...overrides,
})

describe('matches', () => {
  it('shows everything when nothing has been typed', () => {
    expect(matches(asset({ facts: null }), '   ')).toBe(true)
  })

  it('finds an asset by what it is, which its handle never says', () => {
    expect(matches(asset(), 'leaf')).toBe(true)
    expect(matches(asset(), 'autumn')).toBe(true)
    expect(matches(asset(), 'scene')).toBe(true)
  })

  it('still finds it by the handle, which is what appears in prompts', () => {
    expect(matches(asset(), 'wet-slate-2')).toBe(true)
  })

  it('narrows on every word rather than widening', () => {
    // Both present.
    expect(matches(asset(), 'leaf slate')).toBe(true)
    // One present, one not: this is not the asset they meant.
    expect(matches(asset(), 'leaf hoodie')).toBe(false)
  })

  it('matches a stem, because half of what people type is one', () => {
    expect(matches(asset(), 'rai')).toBe(true)
  })

  it('finds nothing but the handle on an asset nobody has described', () => {
    const plain = asset({ facts: null })
    expect(matches(plain, 'wet-slate')).toBe(true)
    expect(matches(plain, 'leaf')).toBe(false)
  })
})
