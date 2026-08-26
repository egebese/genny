import { describe, expect, it } from 'vitest'
import { redact } from './redact.ts'

describe('redact', () => {
  it('masks known secret keys regardless of case', () => {
    const out = redact({ FAL_KEY: 'abc', Authorization: 'Bearer x', prompt: 'a cat' })
    expect(out).toEqual({ FAL_KEY: '[redacted]', Authorization: '[redacted]', prompt: 'a cat' })
  })

  it('masks a fal key that leaked into an innocent-looking field', () => {
    const leaked = '11111111-2222-3333-4444-555555555555:0123456789abcdef0123'
    const out = redact({ message: `request failed with key ${leaked}` }) as { message: string }
    expect(out.message).toBe('request failed with key [redacted]')
  })

  it('walks nested structures', () => {
    const out = redact({ job: { input: { falKey: 'secret' }, tags: ['a'] } })
    expect(out).toEqual({ job: { input: { falKey: '[redacted]' }, tags: ['a'] } })
  })

  it('stops at absurd depth instead of blowing the stack', () => {
    type Nested = { next?: Nested }
    let node: Nested = {}
    for (let i = 0; i < 20; i++) node = { next: node }
    expect(() => redact(node)).not.toThrow()
  })
})
