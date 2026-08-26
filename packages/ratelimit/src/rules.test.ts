import { describe, expect, it } from 'vitest'
import { GENERATION_LIMITS, generationRule, tierOf } from './rules.ts'

describe('tierOf', () => {
  it('holds anonymous visitors down whatever plan the row claims', () => {
    expect(tierOf({ kind: 'anonymous', planId: 'studio' })).toBe('anonymous')
  })

  it('gives a signed-in actor with no plan the free tier', () => {
    expect(tierOf({ kind: 'registered', planId: null })).toBe('free')
  })

  it('reads the plan when there is one', () => {
    expect(tierOf({ kind: 'registered', planId: 'creative' })).toBe('creative')
  })

  it('falls back to free for a plan it has never heard of', () => {
    expect(tierOf({ kind: 'registered', planId: 'enterprise-2029' })).toBe('free')
  })
})

describe('generationRule', () => {
  it('rises with the tier', () => {
    const limits = (['anonymous', 'free', 'starter', 'creative', 'studio'] as const).map(
      (tier) => generationRule(tier, 'actor-1').limit,
    )
    expect(limits).toEqual([...limits].sort((a, b) => a - b))
    expect(new Set(limits).size).toBe(limits.length)
  })

  it('keeps one bucket per actor, so changing plan is not a fresh allowance', () => {
    expect(generationRule('free', 'actor-1').bucket).toBe(
      generationRule('studio', 'actor-1').bucket,
    )
  })

  it('separates actors', () => {
    expect(generationRule('free', 'a').bucket).not.toBe(generationRule('free', 'b').bucket)
  })

  it('treats an unknown tier as free rather than throwing', () => {
    expect(generationRule('nonsense', 'actor-1').limit).toBe(GENERATION_LIMITS.free.limit)
  })
})
