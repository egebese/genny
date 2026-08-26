import { describe, expect, it } from 'vitest'
import { falKeyInput, generationRequest } from './schema.ts'

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

describe('generationRequest', () => {
  it('accepts a minimal request and defaults the rest', () => {
    const parsed = generationRequest.parse({ modelId: 'fal-ai/x', prompt: 'a cat' })
    expect(parsed.references).toEqual([])
    expect(parsed.settings).toEqual({})
  })

  it('rejects an empty prompt', () => {
    expect(() => generationRequest.parse({ modelId: 'fal-ai/x', prompt: '' })).toThrow()
  })

  it('rejects a reference id that is not a uuid', () => {
    expect(() =>
      generationRequest.parse({
        modelId: 'fal-ai/x',
        prompt: 'a cat',
        references: [{ token: '@a', label: 'a', kind: 'asset', id: 'not-a-uuid' }],
      }),
    ).toThrow()
  })

  it('caps the number of references rather than trusting the client', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      token: `@a${i}`,
      label: `a${i}`,
      kind: 'asset' as const,
      id: '11111111-2222-3333-4444-555555555555',
    }))
    expect(() =>
      generationRequest.parse({ modelId: 'fal-ai/x', prompt: 'a cat', references: many }),
    ).toThrow()
  })
})
