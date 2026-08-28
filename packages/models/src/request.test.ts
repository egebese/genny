import { describe, expect, it } from 'vitest'
import { generationRequest } from './request.ts'

describe('generationRequest', () => {
  it('accepts a minimal request and defaults the rest', () => {
    const parsed = generationRequest.parse({ modelId: 'fal-ai/x', prompt: 'a cat' })
    expect(parsed.references).toEqual([])
    expect(parsed.settings).toEqual({})
  })

  it('leaves an empty prompt to the model to refuse', () => {
    /*
     * This used to be rejected here. An upscaler has no prompt at all, and a
     * floor of one character in the shared request made every such model
     * unreachable rather than making anything safer. The refusal moved to the
     * schema built from the model's own entry, where it knows whether this
     * particular endpoint needs a sentence: see `input.test.ts`.
     */
    expect(generationRequest.parse({ modelId: 'fal-ai/x', prompt: '' }).prompt).toBe('')
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
