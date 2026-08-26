import { describe, expect, it } from 'vitest'
import { sealKey, secretsMatch, unsealKey } from './key-cipher.ts'

const KEY = Buffer.alloc(32, 3).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')
const FAL_KEY = '11111111-2222-3333-4444-555555555555:0123456789abcdef'

describe('sealKey / unsealKey', () => {
  it('round-trips a key', () => {
    const result = unsealKey(sealKey(FAL_KEY, KEY, 3600), KEY)
    expect(result).toMatchObject({ ok: true, falKey: FAL_KEY })
  })

  it('produces a different ciphertext every time for the same key', () => {
    expect(sealKey(FAL_KEY, KEY, 3600)).not.toBe(sealKey(FAL_KEY, KEY, 3600))
  })

  it('never puts the key in the ciphertext in readable form', () => {
    expect(sealKey(FAL_KEY, KEY, 3600)).not.toContain('0123456789abcdef')
  })

  it('rejects a payload sealed with a different encryption key', () => {
    const result = unsealKey(sealKey(FAL_KEY, OTHER_KEY, 3600), KEY)
    expect(result).toEqual({ ok: false, reason: 'tampered' })
  })

  it('rejects a tampered ciphertext', () => {
    const sealed = sealKey(FAL_KEY, KEY, 3600)
    const parts = sealed.split('.')
    const flipped = `${parts[0]}.${parts[1]}.${(parts[2] ?? '').slice(0, -2)}AA`
    expect(unsealKey(flipped, KEY)).toEqual({ ok: false, reason: 'tampered' })
  })

  it('rejects a tampered auth tag', () => {
    const [iv, , data] = sealKey(FAL_KEY, KEY, 3600).split('.')
    const forgedTag = Buffer.alloc(16, 1).toString('base64url')
    expect(unsealKey(`${iv}.${forgedTag}.${data}`, KEY)).toEqual({ ok: false, reason: 'tampered' })
  })

  it('rejects a malformed value without throwing', () => {
    for (const value of ['', 'nope', 'a.b', 'a.b.c.d']) {
      expect(unsealKey(value, KEY).ok).toBe(false)
    }
  })

  it('expires on its own embedded deadline, not on a cookie attribute', () => {
    const sealed = sealKey(FAL_KEY, KEY, 60)
    expect(unsealKey(sealed, KEY, Date.now() + 59_000).ok).toBe(true)
    expect(unsealKey(sealed, KEY, Date.now() + 61_000)).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses to seal an empty key', () => {
    expect(() => sealKey('   ', KEY, 60)).toThrow(/empty/)
  })

  it('refuses an encryption key that is too short to be one', () => {
    expect(() => sealKey(FAL_KEY, 'dGlueQ==', 60)).toThrow(/32 bytes/)
  })
})

describe('secretsMatch', () => {
  it('matches identical secrets and rejects different ones', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true)
    expect(secretsMatch('abc', 'abd')).toBe(false)
  })

  it('handles length mismatches without throwing', () => {
    expect(secretsMatch('short', 'much longer value')).toBe(false)
  })
})
