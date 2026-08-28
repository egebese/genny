import { describe, expect, it } from 'vitest'
import { stillOnFal, TRUSTED_FOR_MS } from './fal-cache.ts'

const now = new Date('2026-08-28T12:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('stillOnFal', () => {
  it('says no about an asset that has never been sent', () => {
    expect(stillOnFal({ falUrl: null, falUrlAt: null }, now)).toBe(false)
  })

  it('says no when half the pair is missing, which is a bug not a cache hit', () => {
    expect(stillOnFal({ falUrl: 'https://v3b.fal.media/x', falUrlAt: null }, now)).toBe(false)
    expect(stillOnFal({ falUrl: null, falUrlAt: ago(1000) }, now)).toBe(false)
  })

  it('reuses a url uploaded during this session', () => {
    expect(stillOnFal({ falUrl: 'https://v3b.fal.media/x', falUrlAt: ago(60_000) }, now)).toBe(true)
  })

  it('sends the bytes again once the url is older than a day', () => {
    const stale = { falUrl: 'https://v3b.fal.media/x', falUrlAt: ago(TRUSTED_FOR_MS + 1) }
    expect(stillOnFal(stale, now)).toBe(false)
  })

  it('does not trust a date in the future, which is a clock and not a file', () => {
    const skewed = { falUrl: 'https://v3b.fal.media/x', falUrlAt: new Date(now.getTime() + 60_000) }
    expect(stillOnFal(skewed, now)).toBe(false)
  })
})
