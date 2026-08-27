import { describe, expect, it } from 'vitest'
import { applyAttachments } from './attachments.ts'
import type { ModelDefinition } from './schema.ts'

const slot = (over: Record<string, unknown>) => ({
  field: 'image_url',
  role: 'source',
  accepts: ['image'],
  array: false,
  maxCount: 1,
  required: false,
  token: 'strip',
  ...over,
})

const model = (references: unknown[]): ModelDefinition =>
  ({
    endpointId: 'fal-ai/test',
    modality: 'video',
    group: 'Image to Video',
    displayName: 'Test',
    description: '',
    featured: false,
    sortOrder: 0,
    pricing: { unit: 'seconds', unitPriceUsd: 0.1 },
    creditMultiplier: 1,
    promptField: 'prompt',
    inputs: [{ name: 'prompt', type: 'string', label: 'Prompt', required: true, hidden: false }],
    references,
    capabilities: { supportsNegativePrompt: false, supportsSeed: false, maxOutputs: 1 },
  }) as ModelDefinition

describe('applyAttachments', () => {
  it('puts each asset in the field it was pinned to', () => {
    const subject = model([
      slot({ field: 'image_url', role: 'start-frame' }),
      slot({ field: 'tail_image_url', role: 'end-frame' }),
    ])
    const { patch, dropped } = applyAttachments(subject, [
      { field: 'tail_image_url', url: 'https://cdn/b.png' },
      { field: 'image_url', url: 'https://cdn/a.png' },
    ])
    // The order they were pinned in is not the order the fields are declared in,
    // and that is the whole reason this exists.
    expect(patch).toEqual({ image_url: 'https://cdn/a.png', tail_image_url: 'https://cdn/b.png' })
    expect(dropped).toEqual([])
  })

  it('fills an array slot up to its limit and reports the rest', () => {
    const subject = model([slot({ field: 'image_urls', array: true, maxCount: 2 })])
    const { patch, dropped } = applyAttachments(subject, [
      { field: 'image_urls', url: 'https://cdn/1.png' },
      { field: 'image_urls', url: 'https://cdn/2.png' },
      { field: 'image_urls', url: 'https://cdn/3.png' },
    ])
    expect(patch).toEqual({ image_urls: ['https://cdn/1.png', 'https://cdn/2.png'] })
    expect(dropped).toEqual(['image_urls'])
  })

  it('lets a second pick replace the first on a single slot', () => {
    const subject = model([slot({ field: 'image_url' })])
    const { patch } = applyAttachments(subject, [
      { field: 'image_url', url: 'https://cdn/old.png' },
      { field: 'image_url', url: 'https://cdn/new.png' },
    ])
    expect(patch).toEqual({ image_url: 'https://cdn/new.png' })
  })

  it('refuses a field the catalog does not declare', () => {
    const subject = model([slot({ field: 'image_url' })])
    const { patch, dropped } = applyAttachments(subject, [
      { field: 'webhook_url', url: 'https://evil/hook' },
    ])
    expect(patch).toEqual({})
    expect(dropped).toEqual(['webhook_url'])
  })
})
