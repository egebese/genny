import { describe, expect, it } from 'vitest'
import { readableSettings } from './readable.ts'
import type { ModelInput } from './schema.ts'

const inputs = [
  { name: 'prompt', type: 'string', label: 'Prompt', required: true, hidden: false },
  { name: 'num_images', type: 'integer', label: 'Images', required: false, hidden: false },
  { name: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', required: false, hidden: false },
  {
    name: 'enable_safety_checker',
    type: 'boolean',
    label: 'Safety checker',
    required: false,
    hidden: true,
  },
] as unknown as ModelInput[]

describe('readableSettings', () => {
  it('names each field the way the dock names it', () => {
    expect(readableSettings({ num_images: 2, aspect_ratio: '16:9' }, inputs, 'prompt')).toEqual([
      { label: 'Images', value: '2' },
      { label: 'Aspect ratio', value: '16:9' },
    ])
  })

  it('leaves out the prompt, which is already the section above', () => {
    expect(readableSettings({ prompt: 'a cat', num_images: 1 }, inputs, 'prompt')).toEqual([
      { label: 'Images', value: '1' },
    ])
  })

  it('leaves out what the model never offered', () => {
    // Hidden flags and mapped reference urls are in the payload and are not
    // things anyone set.
    const payload = { enable_safety_checker: true, image_url: 'https://cdn/a.png', num_images: 1 }
    expect(readableSettings(payload, inputs, 'prompt')).toEqual([{ label: 'Images', value: '1' }])
  })

  it('leaves out a control that was never filled in', () => {
    expect(readableSettings({ aspect_ratio: '', num_images: 1 }, inputs, 'prompt')).toEqual([
      { label: 'Images', value: '1' },
    ])
  })

  it('reads a boolean as a state rather than as a literal', () => {
    const visible = [
      { name: 'multi_shots', type: 'boolean', label: 'Multiple shots', hidden: false },
    ] as unknown as ModelInput[]
    expect(readableSettings({ multi_shots: true }, visible, 'prompt')).toEqual([
      { label: 'Multiple shots', value: 'on' },
    ])
  })
})
