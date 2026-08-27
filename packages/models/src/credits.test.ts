import { describe, expect, it } from 'vitest'
import { creditsFor, estimateUnits, megapixelsFor } from './credits.ts'
import type { ModelDefinition } from './schema.ts'

const model = (overrides: Partial<ModelDefinition> = {}): ModelDefinition =>
  ({
    endpointId: 'fal-ai/test',
    modality: 'image',
    group: 'Text to Image',
    displayName: 'Test',
    description: '',
    featured: false,
    sortOrder: 0,
    pricing: { unit: 'images', unitPriceUsd: 0.08 },
    creditMultiplier: 1.25,
    inputs: [{ name: 'prompt', type: 'string', label: 'Prompt', required: true, hidden: false }],
    references: [],
    capabilities: { supportsNegativePrompt: false, supportsSeed: false, maxOutputs: 1 },
    ...overrides,
  }) as ModelDefinition

describe('creditsFor', () => {
  it('applies price, quantity, multiplier and the credit rate', () => {
    // 0.08 usd * 2 images * 1.25 markup = 0.20 usd -> 200 credits at 1000/usd
    expect(creditsFor(model(), { units: 2 }, 1000)).toBe(200)
  })

  it('rounds up so a fraction of a cent is never sold at a loss', () => {
    const cheap = model({ pricing: { unit: 'images', unitPriceUsd: 0.0001 }, creditMultiplier: 1 })
    expect(creditsFor(cheap, { units: 1 }, 1000)).toBe(1)
  })

  it('refuses a non-positive quantity instead of charging zero', () => {
    expect(() => creditsFor(model(), { units: 0 }, 1000)).toThrow(/positive/)
    expect(() => creditsFor(model(), { units: -3 }, 1000)).toThrow(/positive/)
  })

  it('scales with the operator markup', () => {
    const base = creditsFor(model({ creditMultiplier: 1 }), { units: 1 }, 1000)
    const marked = creditsFor(model({ creditMultiplier: 2 }), { units: 1 }, 1000)
    expect(marked).toBe(base * 2)
  })
})

describe('estimateUnits', () => {
  it('counts images for image-billed models', () => {
    expect(estimateUnits(model(), { num_images: 3 })).toBe(3)
  })

  it('defaults to a single unit when the count is missing or nonsense', () => {
    expect(estimateUnits(model(), {})).toBe(1)
    expect(estimateUnits(model(), { num_images: 0 })).toBe(1)
    expect(estimateUnits(model(), { num_images: 'many' })).toBe(1)
  })

  it('converts a named image size into megapixels', () => {
    const mp = model({ pricing: { unit: 'megapixels', unitPriceUsd: 0.025 } })
    expect(estimateUnits(mp, { image_size: 'square_hd', num_images: 1 })).toBeCloseTo(1.048576, 5)
    expect(estimateUnits(mp, { image_size: 'landscape_4_3', num_images: 2 })).toBeCloseTo(
      1.572864,
      5,
    )
  })

  it('falls back to a full megapixel for an unknown size rather than charging nothing', () => {
    const mp = model({ pricing: { unit: 'megapixels', unitPriceUsd: 0.025 } })
    expect(estimateUnits(mp, { image_size: 'not_a_size' })).toBeCloseTo(1.048576, 5)
  })

  it('multiplies seconds by clip count for duration-billed models', () => {
    const video = model({ pricing: { unit: 'seconds', unitPriceUsd: 0.07 } })
    expect(estimateUnits(video, { duration: 8, num_images: 2 })).toBe(16)
    expect(estimateUnits(video, {})).toBe(5)
  })
})

describe('megapixelsFor', () => {
  it('reports megapixels for a batch', () => {
    expect(megapixelsFor(1000, 1000, 3)).toBe(3)
  })
})

describe('durations however the endpoint spells them', () => {
  const perSecond = { pricing: { unit: 'seconds' as const, unitPriceUsd: 0.1 } }

  it('reads a number, a numeric string and a suffixed one alike', () => {
    expect(estimateUnits(perSecond, { duration: 8 })).toBe(8)
    expect(estimateUnits(perSecond, { duration: '8' })).toBe(8)
    // Veo and friends offer "4s" / "6s" / "8s". Number() gives NaN here, the
    // hold falls back to five, and settle never captures more than it held, so
    // the extra three seconds would be free every time.
    expect(estimateUnits(perSecond, { duration: '8s' })).toBe(8)
  })

  it('still falls back when there is no number in there at all', () => {
    expect(estimateUnits(perSecond, { duration: 'auto' })).toBe(5)
    expect(estimateUnits(perSecond, {})).toBe(5)
    expect(estimateUnits(perSecond, { duration: -3 })).toBe(5)
  })
})
