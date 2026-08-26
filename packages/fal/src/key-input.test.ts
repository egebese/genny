import { describe, expect, it } from 'vitest'
import { falKeyInput } from './key-input.ts'

describe('falKeyInput', () => {
  it('accepts the two-part key fal issues', () => {
    // 69 characters: a uuid, a colon, a 32-character hex secret.
    const real = `${'0123abcd-4567-89ef-0123-456789abcdef'}:${'a'.repeat(32)}`
    expect(falKeyInput.parse({ key: real }).key).toBe(real)
  })

  it('accepts a longer multi-part token too', () => {
    /*
     * Not every fal-shaped credential is `id:secret`. A token found on this
     * machine was 134 characters across three colon-separated parts with base64
     * padding. Rather than encode a guess about which shapes exist, validation
     * only rejects what cannot be a key at all.
     */
    const longer = `${'a'.repeat(16)}/MnSRiXlx:${'b'.repeat(60)}=:${'c'.repeat(40)}`
    expect(() => falKeyInput.parse({ key: longer })).not.toThrow()
  })

  it('trims incidental whitespace from a paste', () => {
    expect(falKeyInput.parse({ key: '  key-id-1234567890:secret  ' }).key).toBe(
      'key-id-1234567890:secret',
    )
  })

  it('rejects something with a space inside it', () => {
    expect(() => falKeyInput.parse({ key: 'key-id-1234567890 secret-value' })).toThrow(/spaces/)
  })

  it('rejects something far too short to be a key', () => {
    expect(() => falKeyInput.parse({ key: 'abc' })).toThrow()
  })
})
