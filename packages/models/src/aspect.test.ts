import { describe, expect, it } from 'vitest'
import { outputAspect, outputCount } from './aspect.ts'

describe('outputAspect', () => {
  it('reads one of fal named image sizes', () => {
    expect(outputAspect('image', { image_size: 'portrait_16_9' })).toEqual({
      width: 576,
      height: 1024,
    })
  })

  it('reads an explicit width and height', () => {
    expect(outputAspect('image', { image_size: { width: 1280, height: 720 } })).toEqual({
      width: 1280,
      height: 720,
    })
  })

  it('reads a ratio however the endpoint spells it', () => {
    expect(outputAspect('video', { aspect_ratio: '9:16' })).toEqual({ width: 9, height: 16 })
    expect(outputAspect('video', { aspect_ratio: '21x9' })).toEqual({ width: 21, height: 9 })
  })

  it('ignores a size it cannot make sense of', () => {
    expect(outputAspect('image', { image_size: 'gigantic' })).toEqual({ width: 1, height: 1 })
    expect(outputAspect('image', { image_size: { width: 0, height: 10 } })).toEqual({
      width: 1,
      height: 1,
    })
    expect(outputAspect('video', { aspect_ratio: 'wide' })).toEqual({ width: 16, height: 9 })
  })

  it('gives audio a strip regardless of what the settings say', () => {
    expect(outputAspect('audio', { aspect_ratio: '1:1' })).toEqual({ width: 4, height: 1 })
  })
})

describe('outputCount', () => {
  it('is one when the model has no count control', () => {
    expect(outputCount({})).toBe(1)
    expect(outputCount({ num_images: 'three' })).toBe(1)
  })

  it('reads whichever name the endpoint uses', () => {
    expect(outputCount({ num_images: 4 })).toBe(4)
    expect(outputCount({ num_outputs: 2 })).toBe(2)
  })

  it('refuses a count that would paper the board', () => {
    expect(outputCount({ num_images: 500 })).toBe(16)
    expect(outputCount({ num_images: 0 })).toBe(1)
    expect(outputCount({ num_images: -3 })).toBe(1)
  })
})
