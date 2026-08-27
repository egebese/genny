import { describe, expect, it } from 'vitest'
import { reassign } from './reassign.ts'
import type { ReferenceSlot } from './slots.ts'

const slot = (over: Partial<ReferenceSlot> = {}): ReferenceSlot => ({
  field: 'image_url',
  role: 'source',
  label: 'Use as input',
  accepts: ['image'],
  array: false,
  maxCount: 1,
  required: false,
  ...over,
})

const image = { kind: 'image' as const }
const video = { kind: 'video' as const }
const audio = { kind: 'audio' as const }

describe('reassign', () => {
  it('puts one image on the first slot that will take it', () => {
    const frames = [slot({ field: 'image_url' }), slot({ field: 'tail_image_url' })]
    expect(reassign([image], frames)).toEqual(['image_url'])
  })

  it('spreads two images across two single slots, in the order attached', () => {
    // Which is what makes a first and a last frame out of two attachments.
    const frames = [slot({ field: 'first_image_url' }), slot({ field: 'end_image_url' })]
    expect(reassign([image, image], frames)).toEqual(['first_image_url', 'end_image_url'])
  })

  it('fills an array slot before looking further', () => {
    const edit = [slot({ field: 'image_urls', array: true, maxCount: 4 })]
    expect(reassign([image, image, image], edit)).toEqual([
      'image_urls',
      'image_urls',
      'image_urls',
    ])
  })

  it('stops at a slot that is full and moves to the next', () => {
    const both = [
      slot({ field: 'image_urls', array: true, maxCount: 2 }),
      slot({ field: 'mask_url' }),
    ]
    expect(reassign([image, image, image], both)).toEqual(['image_urls', 'image_urls', 'mask_url'])
  })

  it('matches on kind, so an audio track skips the image slots', () => {
    const lipsync = [
      slot({ field: 'video_url', accepts: ['video'] }),
      slot({ field: 'audio_url', accepts: ['audio'] }),
    ]
    expect(reassign([audio, video], lipsync)).toEqual(['audio_url', 'video_url'])
  })

  it('drops what has nowhere to go rather than sending it somewhere', () => {
    // A text to speech model has no slots, and an image on it is a 422.
    expect(reassign([image, image], [])).toEqual([null, null])
    expect(reassign([image, video], [slot()])).toEqual(['image_url', null])
  })

  it('drops only the overflow, keeping what fits', () => {
    expect(reassign([image, image], [slot()])).toEqual(['image_url', null])
  })
})
