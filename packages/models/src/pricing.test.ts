import { describe, expect, it } from 'vitest'
import { estimateUnits } from './credits.ts'
import { secondsOf } from './duration.ts'
import type { ModelPricing } from './pricing.ts'

describe('rates that stack', () => {
  // GPT Image 2 charges by quality and by size, and the two multiply.
  const twoDimensional = {
    pricing: {
      unit: 'images' as const,
      unitPriceUsd: 0.01,
      scale: [
        { field: 'quality', factors: { low: 0.5, high: 4 } },
        { field: 'image_size', factors: { '1024x1536': 1.5 } },
      ],
    },
  }

  it('multiplies every rate that applies', () => {
    expect(estimateUnits(twoDimensional, { quality: 'high', image_size: '1024x1536' })).toBe(6)
  })

  it('leaves out the ones nobody chose', () => {
    expect(estimateUnits(twoDimensional, { quality: 'high' })).toBe(4)
    expect(estimateUnits(twoDimensional, {})).toBe(1)
  })

  it('reads a numeric option as the choice it is', () => {
    const numbered = {
      pricing: {
        unit: 'images' as const,
        unitPriceUsd: 1,
        scale: [{ field: 'n', factors: { 4: 4 } }],
      },
    }
    expect(estimateUnits(numbered, { n: 4 })).toBe(4)
  })
})

describe('flat fees', () => {
  // A web search is $0.015 on a $0.15 image, whatever the image turns out to be.
  const searching = {
    pricing: {
      unit: 'images' as const,
      unitPriceUsd: 0.15,
      surcharges: [{ field: 'web_search', when: [true], addUsd: 0.015 }],
    },
  }

  it('adds the fee as units, so one number still prices the request', () => {
    expect(estimateUnits(searching, { web_search: true })).toBeCloseTo(1.1, 10)
    expect(estimateUnits(searching, { web_search: false })).toBe(1)
    expect(estimateUnits(searching, {})).toBe(1)
  })

  it('charges it once however many images come back', () => {
    expect(estimateUnits(searching, { web_search: true, num_images: 4 })).toBeCloseTo(4.1, 10)
  })
})

describe('how long the output is', () => {
  const perSecond = (duration?: ModelPricing['duration']): ModelPricing => ({
    unit: 'seconds',
    unitPriceUsd: 0.1,
    duration,
  })

  it('still reads the field everything used to call duration', () => {
    expect(secondsOf(perSecond(), { duration: 8 })).toBe(8)
    expect(secondsOf(perSecond(), { duration_seconds: 12 })).toBe(12)
  })

  it('takes the length the entry names, wherever it lives', () => {
    const music = perSecond({ field: 'music_length_ms', unit: 'milliseconds', assume: 30 })
    expect(secondsOf(music, { music_length_ms: 90_000 })).toBe(90)
  })

  it('holds the declared ceiling when the model picks its own length', () => {
    // "auto" is the default on every FLUX 3 and Seedance route, and it used to
    // fall through to five seconds however long the clip came back.
    const auto = perSecond({ unit: 'seconds', assume: 20 })
    expect(secondsOf(auto, { duration: 'auto' })).toBe(20)
    expect(secondsOf(auto, {})).toBe(20)
    expect(secondsOf(auto, { duration: 6 })).toBe(6)
  })

  it('reads a duration fal wrote as text, including one with a unit on it', () => {
    expect(secondsOf(perSecond(), { duration: '10' })).toBe(10)
    expect(secondsOf(perSecond(), { duration: '8s' })).toBe(8)
  })

  it('prices a minute-billed model by the length it will actually make', () => {
    const music = {
      pricing: {
        unit: 'minutes' as const,
        unitPriceUsd: 0.6,
        duration: { field: 'music_length_ms', unit: 'milliseconds' as const, assume: 60 },
      },
    }
    // Ten minutes of music, not the one minute the old fallback assumed.
    expect(estimateUnits(music, { music_length_ms: 600_000 })).toBe(10)
    expect(estimateUnits(music, {})).toBe(1)
  })
})

describe('a rate that two controls decide together', () => {
  /*
   * Veo. $0.20 a second at 720p without audio and $0.40 with, $0.40 at 4K
   * without and $0.60 with. No pair of factors multiplies to that table: the
   * audio surcharge doubles the price at one resolution and adds half at the
   * other.
   */
  const veo: ModelPricing = {
    unit: 'seconds',
    unitPriceUsd: 0.4,
    scale: [
      {
        field: 'resolution',
        and: 'generate_audio',
        factors: { '720p|false': 0.5, '1080p|false': 0.5, '4k|true': 1.5, '4k|false': 1 },
      },
    ],
  }
  const at = (input: Record<string, unknown>) => estimateUnits({ pricing: veo }, input) * 0.4

  it('prices every corner of the table', () => {
    expect(at({ duration: 1, resolution: '720p', generate_audio: true })).toBeCloseTo(0.4, 10)
    expect(at({ duration: 1, resolution: '720p', generate_audio: false })).toBeCloseTo(0.2, 10)
    expect(at({ duration: 1, resolution: '4k', generate_audio: true })).toBeCloseTo(0.6, 10)
    expect(at({ duration: 1, resolution: '4k', generate_audio: false })).toBeCloseTo(0.4, 10)
  })

  it('bills the base rate when only one of the two was chosen', () => {
    expect(at({ duration: 1, resolution: '4k' })).toBeCloseTo(0.4, 10)
  })
})
