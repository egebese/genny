import { describe, expect, it } from 'vitest'
import { looksGrouped, matches, type Searchable } from './search.ts'

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

describe('looksGrouped', () => {
  const at = (id: string, groupKey: string | null) => ({
    id,
    label: id,
    facts: groupKey ? { shortName: id, subject: '', kind: 'product', groupKey, tags: [] } : null,
  })

  it('offers a group where several assets say they are the same subject', () => {
    const found = looksGrouped([
      at('a', 'offwhite-hoodie'),
      at('b', 'offwhite-hoodie'),
      at('c', 'brass-compass'),
    ])
    expect(found).toHaveLength(1)
    expect(found[0]?.groupKey).toBe('offwhite-hoodie')
    expect(found[0]?.assets.map((one) => one.id)).toEqual(['a', 'b'])
  })

  it('says nothing about a subject that appears once', () => {
    expect(looksGrouped([at('a', 'brass-compass')])).toEqual([])
  })

  it('says nothing about assets nobody has described', () => {
    expect(looksGrouped([at('a', null), at('b', null)])).toEqual([])
  })

  it('puts the biggest group first, since that is the most worth doing', () => {
    const found = looksGrouped([
      at('a', 'small'),
      at('b', 'small'),
      at('c', 'big'),
      at('d', 'big'),
      at('e', 'big'),
    ])
    expect(found.map((one) => one.groupKey)).toEqual(['big', 'small'])
  })
})
