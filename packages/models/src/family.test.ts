import { describe, expect, it } from 'vitest'
import { familyAccepts, resolveTask, type Task } from './family.ts'
import type { ReferenceSlot, Slotted } from './slots.ts'

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

const task = (
  endpointId: string,
  slots: ReferenceSlot[],
  required: ReferenceSlot[] = [],
): Task<Slotted> => ({ endpointId, modality: 'image', slots, required })

const t2i = task('fal-ai/nano-banana-2', [])
const edit = task(
  'fal-ai/nano-banana-2/edit',
  [slot({ field: 'image_urls', array: true, maxCount: 4, required: true })],
  [slot({ field: 'image_urls', array: true, maxCount: 4, required: true })],
)

describe('resolveTask', () => {
  it('writes from text when nothing was handed over', () => {
    expect(resolveTask([t2i, edit], [])?.endpointId).toBe('fal-ai/nano-banana-2')
  })

  it('reaches the edit endpoint the moment an image is handed over', () => {
    // The whole point: the picker picks Nano Banana 2 and the URL follows.
    expect(resolveTask([t2i, edit], ['image'])?.endpointId).toBe('fal-ai/nano-banana-2/edit')
  })

  it('prefers the endpoint that uses the most of what it was given', () => {
    const lipsync = task('fal-ai/x/lipsync', [
      slot({ field: 'video_url', accepts: ['video'] }),
      slot({ field: 'audio_url', accepts: ['audio'] }),
    ])
    const videoOnly = task('fal-ai/x/upscale', [slot({ field: 'video_url', accepts: ['video'] })])
    expect(resolveTask([videoOnly, lipsync], ['video', 'audio'])?.endpointId).toBe(
      'fal-ai/x/lipsync',
    )
  })

  it('will not send an image to an endpoint with nowhere to put it', () => {
    expect(resolveTask([t2i], ['image'])).toBeNull()
  })

  it('will not send nothing to an endpoint that insists on something', () => {
    expect(resolveTask([edit], [])).toBeNull()
  })

  it('breaks a tie on the shorter endpoint, which is the plainer task', () => {
    const plain = task('fal-ai/x', [slot()])
    const fancy = task('fal-ai/x/with/extra/steps', [slot()])
    expect(resolveTask([fancy, plain], ['image'])?.endpointId).toBe('fal-ai/x')
  })
})

describe('familyAccepts', () => {
  it('is the union across the model, not one endpoint of it', () => {
    // Which is why the right-click menu can offer an image on Nano Banana 2.
    expect(familyAccepts([t2i, edit])).toEqual(['image'])
    expect(familyAccepts([t2i])).toEqual([])
  })
})

describe('resolveTask counts what it was given', () => {
  const one = task(
    'fal-ai/pixverse/c1/image-to-video',
    [slot({ required: true })],
    [slot({ required: true })],
  )
  const two = task(
    'fal-ai/pixverse/c1/transition',
    [
      slot({ field: 'first_image_url', required: true }),
      slot({ field: 'end_image_url', required: true }),
    ],
    [
      slot({ field: 'first_image_url', required: true }),
      slot({ field: 'end_image_url', required: true }),
    ],
  )

  it('sends one image to the endpoint that wants one', () => {
    // The transition endpoint would take it and then answer 422 for the frame
    // nobody gave it.
    expect(resolveTask([two, one], ['image'])?.endpointId).toBe('fal-ai/pixverse/c1/image-to-video')
  })

  it('sends two images to the endpoint that wants two', () => {
    expect(resolveTask([one, two], ['image', 'image'])?.endpointId).toBe(
      'fal-ai/pixverse/c1/transition',
    )
  })

  it('has nothing for an endpoint that needs one when none was given', () => {
    expect(resolveTask([one, two], [])).toBeNull()
  })
})
