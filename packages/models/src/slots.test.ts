import { describe, expect, it } from 'vitest'
import type { ModelDefinition } from './schema.ts'
import { acceptsAll, capacityFor, slotsFor } from './slots.ts'

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

describe('slotsFor', () => {
  it('offers only the slots that take the kind on offer', () => {
    const subject = model([
      slot({ field: 'image_url', role: 'start-frame', accepts: ['image'] }),
      slot({ field: 'audio_url', role: 'source-audio', accepts: ['audio'] }),
    ])
    expect(slotsFor(subject, 'image').map((s) => s.field)).toEqual(['image_url'])
    expect(slotsFor(subject, 'audio').map((s) => s.field)).toEqual(['audio_url'])
    expect(slotsFor(subject, 'video')).toEqual([])
  })

  it('names a slot from its role, so a catalog entry writes copy only to override', () => {
    const [start, end] = slotsFor(
      model([
        slot({ field: 'image_url', role: 'start-frame' }),
        slot({ field: 'tail_image_url', role: 'end-frame' }),
      ]),
      'image',
    )
    expect(start?.label).toBe('Use as start frame')
    expect(end?.label).toBe('Use as end frame')
  })

  it('lets an entry override the label when the default reads wrong', () => {
    const [only] = slotsFor(
      model([slot({ role: 'source', label: 'Replace the subject' })]),
      'image',
    )
    expect(only?.label).toBe('Replace the subject')
  })
})

describe('capacityFor', () => {
  it('adds up every slot that fits, because a selection can fill more than one', () => {
    const subject = model([
      slot({ field: 'image_url', role: 'start-frame' }),
      slot({ field: 'tail_image_url', role: 'end-frame' }),
      slot({ field: 'image_urls', role: 'input-images', array: true, maxCount: 4 }),
    ])
    expect(capacityFor(subject, 'image')).toBe(6)
    expect(capacityFor(subject, 'video')).toBe(0)
  })
})

describe('acceptsAll', () => {
  it('is true only when every kind has somewhere to go', () => {
    const lipsync = model([
      slot({ field: 'video_url', role: 'source-video', accepts: ['video'] }),
      slot({ field: 'audio_url', role: 'source-audio', accepts: ['audio'] }),
    ])
    expect(acceptsAll(lipsync, ['video', 'audio'])).toBe(true)
    expect(acceptsAll(lipsync, ['video', 'image'])).toBe(false)
    expect(acceptsAll(lipsync, [])).toBe(true)
  })
})
