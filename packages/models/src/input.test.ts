import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'
import { buildInputSchema } from './input.ts'

async function schemaFor(endpointId: string) {
  const entry = (await loadCatalog()).find((e) => e.definition.endpointId === endpointId)
  if (!entry) throw new Error(`missing catalog entry ${endpointId}`)
  return buildInputSchema(entry.definition)
}

describe('buildInputSchema', () => {
  it('accepts a valid payload and fills declared defaults', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2')
    const parsed = schema.parse({ prompt: 'a shiba inu chef' }) as Record<string, unknown>
    expect(parsed.resolution).toBe('1K')
    expect(parsed.num_images).toBe(1)
    expect(parsed.output_format).toBe('png')
  })

  it('takes a prompt and nothing else, for every model in the catalog', async () => {
    /*
     * What the dock actually submits. Settings start empty and fill as controls
     * are touched, so a payload of nothing but the prompt is the ordinary case,
     * not the edge one: someone types a sentence and presses the button.
     *
     * H3 Max shipped a field fal marks required and then defaults itself. The
     * builder treated required and defaulted as exclusive, so every generation
     * on it was refused with "the model rejected these settings" before a
     * request was made, and no setting was wrong.
     */
    for (const { definition } of await loadCatalog()) {
      // A model with no prompt is asked for nothing at all, which is the same
      // question: can a generation nobody adjusted validate.
      const only = definition.promptField
        ? { [definition.promptField]: 'a paper boat in a rain gutter' }
        : {}
      const parsed = buildInputSchema(definition).safeParse(only)
      expect(parsed.success, `${definition.endpointId}: ${parsed.error?.message}`).toBe(true)
    }
  })

  it('rejects a missing required prompt', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2')
    expect(() => schema.parse({})).toThrow()
    // And an empty one, which is what the shared request now lets through so
    // that models with no prompt at all can exist.
    expect(() => schema.parse({ prompt: '' })).toThrow()
  })

  it('rejects a value outside the declared enum', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2')
    expect(() => schema.parse({ prompt: 'x', resolution: '8K' })).toThrow()
  })

  it('rejects a count beyond the model maximum', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2')
    expect(() => schema.parse({ prompt: 'x', num_images: 99 })).toThrow()
  })

  it('rejects unknown fields rather than forwarding them to fal', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2')
    expect(() => schema.parse({ prompt: 'x', enable_web_search: true })).toThrow()
  })

  it('enforces numeric bounds declared in the catalog', async () => {
    const schema = await schemaFor('fal-ai/flux/dev')
    expect(() => schema.parse({ prompt: 'x', num_inference_steps: 0 })).toThrow()
    expect(() => schema.parse({ prompt: 'x', guidance_scale: 100 })).toThrow()
    expect(schema.parse({ prompt: 'x', guidance_scale: 3.5 })).toBeTruthy()
  })

  it('permits reference fields for models that declare them', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2/edit')
    const parsed = schema.parse({ prompt: 'x', image_urls: ['https://cdn/a.png'] }) as Record<
      string,
      unknown
    >
    expect(parsed.image_urls).toEqual(['https://cdn/a.png'])
  })

  it('rejects a reference field that is not a url', async () => {
    const schema = await schemaFor('fal-ai/nano-banana-2/edit')
    expect(() => schema.parse({ prompt: 'x', image_urls: ['not-a-url'] })).toThrow()
  })
})
