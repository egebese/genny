import { describe, expect, it } from 'vitest'
import { buildStorageKey, keyBelongsTo, publicUrlFor } from './keys.ts'

const OWNER = '11111111-2222-3333-4444-555555555555'
const OTHER = '99999999-8888-7777-6666-555555555555'

describe('storage keys', () => {
  it('scopes a key to its owner', () => {
    expect(buildStorageKey(OWNER, 'png')).toMatch(new RegExp(`^u/${OWNER}/[0-9a-f-]{36}\\.png$`))
  })

  it('never repeats a key', () => {
    expect(buildStorageKey(OWNER, 'png')).not.toBe(buildStorageKey(OWNER, 'png'))
  })

  it('leaks nothing about the content: no prompt, no filename, no sequence', () => {
    const key = buildStorageKey(OWNER, 'png')
    expect(key).not.toMatch(/prompt|shiba|\d{13}/)
  })

  it('recognises its own owner and rejects another', () => {
    const key = buildStorageKey(OWNER, 'png')
    expect(keyBelongsTo(OWNER, key)).toBe(true)
    expect(keyBelongsTo(OTHER, key)).toBe(false)
  })

  it('refuses a traversal attempt even under the right prefix', () => {
    expect(keyBelongsTo(OWNER, `u/${OWNER}/../${OTHER}/secret.png`)).toBe(false)
  })

  it('builds a public url without doubling the slash', () => {
    expect(publicUrlFor('http://localhost:9100/genny/', 'u/a/b.png')).toBe(
      'http://localhost:9100/genny/u/a/b.png',
    )
    expect(publicUrlFor('http://localhost:9100/genny', 'u/a/b.png')).toBe(
      'http://localhost:9100/genny/u/a/b.png',
    )
  })
})
