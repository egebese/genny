import { describe, expect, it } from 'vitest'
import { missingRequiredReferences, type PromptReference, resolvePrompt } from './references.ts'
import type { ModelDefinition } from './schema.ts'

const ref = (label: string, url: string): PromptReference => ({ token: `@${label}`, label, url })

/** The catalog defaults these; the inferred output type does not, so tests do. */
type PartialMapping = Omit<ModelDefinition['references'][number], 'role' | 'accepts'> &
  Partial<Pick<ModelDefinition['references'][number], 'role' | 'accepts'>>

const withMapping = (mappings: PartialMapping[]): ModelDefinition =>
  ({
    endpointId: 'fal-ai/test',
    modality: 'image',
    group: 'Editing',
    displayName: 'Test',
    description: '',
    featured: false,
    sortOrder: 0,
    pricing: { unit: 'images', unitPriceUsd: 0.08 },
    creditMultiplier: 1,
    inputs: [{ name: 'prompt', type: 'string', label: 'Prompt', required: true, hidden: false }],
    references: mappings.map((mapping) => ({
      role: 'source' as const,
      accepts: ['image' as const],
      ...mapping,
    })),
    capabilities: { supportsNegativePrompt: false, supportsSeed: false, maxOutputs: 1 },
  }) as ModelDefinition

describe('resolvePrompt', () => {
  it('maps references into an array field and keeps the label as a subject cue', () => {
    const model = withMapping([
      { field: 'image_urls', array: true, maxCount: 8, token: 'keep-label', required: false },
    ])
    const result = resolvePrompt(model, '@ayse standing in @room1', [
      ref('ayse', 'https://cdn/a.png'),
      ref('room1', 'https://cdn/r.png'),
    ])
    expect(result.patch).toEqual({ image_urls: ['https://cdn/a.png', 'https://cdn/r.png'] })
    expect(result.text).toBe('ayse standing in room1')
    expect(result.dropped).toEqual([])
  })

  it('maps a single reference into a scalar field and strips the token', () => {
    const model = withMapping([
      { field: 'image_url', array: false, maxCount: 1, token: 'strip', required: false },
    ])
    const result = resolvePrompt(model, 'make @hero cinematic', [ref('hero', 'https://cdn/h.png')])
    expect(result.patch).toEqual({ image_url: 'https://cdn/h.png' })
    expect(result.text).toBe('make cinematic')
  })

  it('reports references the model cannot accept instead of dropping them silently', () => {
    const model = withMapping([
      { field: 'image_urls', array: true, maxCount: 1, token: 'strip', required: false },
    ])
    const result = resolvePrompt(model, '@a and @b', [
      ref('a', 'https://cdn/a.png'),
      ref('b', 'https://cdn/b.png'),
    ])
    expect(result.patch).toEqual({ image_urls: ['https://cdn/a.png'] })
    expect(result.dropped.map((r) => r.label)).toEqual(['b'])
  })

  it('drops every reference for a model with no reference slots', () => {
    const result = resolvePrompt(withMapping([]), 'a cat with @ayse', [
      ref('ayse', 'https://cdn/a.png'),
    ])
    expect(result.patch).toEqual({})
    expect(result.dropped.map((r) => r.label)).toEqual(['ayse'])
    expect(result.text).toBe('a cat with')
  })

  it('tidies the spacing left behind by a stripped token', () => {
    const model = withMapping([
      { field: 'image_url', array: false, maxCount: 1, token: 'strip', required: false },
    ])
    const result = resolvePrompt(model, 'a photo of @hero , golden hour', [
      ref('hero', 'https://cdn/h.png'),
    ])
    expect(result.text).toBe('a photo of, golden hour')
  })

  it('replaces every occurrence of a repeated mention', () => {
    const model = withMapping([
      { field: 'image_url', array: false, maxCount: 1, token: 'keep-label', required: false },
    ])
    const result = resolvePrompt(model, '@hero looks at @hero', [ref('hero', 'https://cdn/h.png')])
    expect(result.text).toBe('hero looks at hero')
  })

  it('leaves a prompt without mentions untouched', () => {
    const result = resolvePrompt(withMapping([]), 'a quiet street at dawn', [])
    expect(result.text).toBe('a quiet street at dawn')
    expect(result.patch).toEqual({})
  })
})

describe('missingRequiredReferences', () => {
  const required = withMapping([
    { field: 'image_url', array: false, maxCount: 1, token: 'strip', required: true },
  ])
  const optional = withMapping([
    { field: 'image_urls', array: true, maxCount: 8, token: 'keep-label', required: false },
  ])

  it('names the slot a model insists on when nothing was mentioned', () => {
    expect(missingRequiredReferences(required, [])).toEqual(['image_url'])
  })

  it('is satisfied once something is mentioned', () => {
    expect(missingRequiredReferences(required, [ref('a', 'https://cdn/a.png')])).toEqual([])
  })

  it('says nothing about an optional slot', () => {
    expect(missingRequiredReferences(optional, [])).toEqual([])
  })

  it('says nothing about a model with no reference slots', () => {
    expect(missingRequiredReferences(withMapping([]), [])).toEqual([])
  })
})
