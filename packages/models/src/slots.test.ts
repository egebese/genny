import { describe, expect, it } from 'vitest'
import type { ModelDefinition } from './schema.ts'
import { acceptsAll, allSlots, capacityFor, slotsFor, suggestFor, unusableKinds } from './slots.ts'

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
      slot({ field: 'audio_url', role: 'driving-audio', accepts: ['audio'] }),
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

describe('a model that takes both ends of the clip', () => {
  it('offers two items, each saying which end it fills', () => {
    const items = slotsFor(
      model([
        slot({ field: 'first_image_url', role: 'start-frame', required: true }),
        slot({ field: 'end_image_url', role: 'end-frame', required: true }),
      ]),
      'image',
    )
    expect(items.map((s) => s.field)).toEqual(['first_image_url', 'end_image_url'])
    // Both take a still, so the copy is the only thing telling them apart. Two
    // items reading the same would leave the pick to chance.
    expect(items.map((s) => s.label)).toEqual(['Use as start frame', 'Use as end frame'])
  })
})

describe('a model whose slots take different kinds', () => {
  it('shows each kind only the slot that will hold it', () => {
    const lipsync = model([
      slot({ field: 'video_url', role: 'source', accepts: ['video'] }),
      slot({ field: 'audio_url', role: 'driving-audio', accepts: ['audio'] }),
    ])
    expect(slotsFor(lipsync, 'video').map((s) => s.label)).toEqual(['Use as input'])
    expect(slotsFor(lipsync, 'audio').map((s) => s.label)).toEqual(['Use as driving audio'])
    expect(slotsFor(lipsync, 'image')).toEqual([])
  })
})

describe('capacityFor', () => {
  it('counts an array slot for what it holds, not for one', () => {
    const editor = model([
      slot({ field: 'image_urls', role: 'input-images', array: true, maxCount: 3 }),
    ])
    expect(capacityFor(editor, 'image')).toBe(3)
  })

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
      slot({ field: 'video_url', role: 'source', accepts: ['video'] }),
      slot({ field: 'audio_url', role: 'driving-audio', accepts: ['audio'] }),
    ])
    expect(acceptsAll(lipsync, ['video', 'audio'])).toBe(true)
    expect(acceptsAll(lipsync, ['video', 'image'])).toBe(false)
    expect(acceptsAll(lipsync, [])).toBe(true)
  })
})

describe('unusableKinds', () => {
  it('names only the kinds with nowhere at all to go', () => {
    const edit = allSlots(model([slot({ field: 'image_urls', array: true, maxCount: 4 })]))
    expect(unusableKinds(edit, ['image'])).toEqual([])
    expect(unusableKinds(edit, ['image', 'video'])).toEqual(['video'])
  })

  it('is the whole list for a model that takes nothing', () => {
    // A text to image endpoint charges the same whether or not you mentioned
    // something, and produces the same picture, which is the problem.
    expect(unusableKinds([], ['image'])).toEqual(['image'])
  })
})

describe('suggestFor', () => {
  const pickable = (
    endpointId: string,
    references: unknown[],
    modality: 'image' | 'video' = 'image',
  ) => ({
    endpointId,
    modality,
    slots: allSlots(model(references)),
  })
  const t2i = pickable('fal-ai/nano-banana-2', [])
  const edit = pickable('fal-ai/nano-banana-2/edit', [
    slot({ field: 'image_urls', array: true, maxCount: 4 }),
  ])
  const other = pickable('fal-ai/aaa-first-alphabetically/edit', [slot({ field: 'image_url' })])

  it('prefers the same model with the input, over anything that merely fits', () => {
    expect(suggestFor([other, edit, t2i], t2i, ['image'])?.endpointId).toBe(
      'fal-ai/nano-banana-2/edit',
    )
  })

  it('falls back to whatever can take it', () => {
    expect(suggestFor([other, t2i], t2i, ['image'])?.endpointId).toBe(
      'fal-ai/aaa-first-alphabetically/edit',
    )
  })

  it('does not offer a model of another modality', () => {
    const clip = pickable('fal-ai/clip', [slot({ field: 'image_url' })], 'video')
    expect(suggestFor([clip], t2i, ['image'])).toBeNull()
  })

  it('has nothing to say when nothing else fits', () => {
    expect(suggestFor([t2i], t2i, ['image'])).toBeNull()
  })
})
