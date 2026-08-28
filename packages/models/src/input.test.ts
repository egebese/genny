import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'
import { buildInputSchema } from './input.ts'
import { type ModelDefinition, type ModelInput, modelDefinition } from './schema.ts'

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
      // A required list of rows is filled in by the dock before it will submit,
      // so the question here is whether everything else can be left alone.
      const rows = Object.fromEntries(
        definition.inputs
          .filter((input) => input.type === 'object-array' && input.required)
          .map((input) => [
            input.name,
            [
              Object.fromEntries(
                (input.fields ?? [])
                  .filter((field) => field.required)
                  .map((field) => [field.name, sample(field)]),
              ),
            ],
          ]),
      )
      const only = definition.promptField
        ? { [definition.promptField]: 'a paper boat in a rain gutter', ...rows }
        : rows
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

/** Something a column would accept, so the row it is in can be built. */
function sample(field: ModelInput): unknown {
  if (field.enum?.[0] !== undefined) return field.enum[0]
  if (field.type === 'integer' || field.type === 'number') return field.min ?? 1
  if (field.type === 'boolean') return false
  return 'x'
}

describe('a control that repeats a row', () => {
  const withLoras = (over: Partial<ModelInput> = {}): ModelDefinition =>
    modelDefinition.parse({
      endpointId: 'minimax/h3/lora/text-to-video',
      family: { id: 'h3-lora', name: 'H3 LoRA' },
      modality: 'video',
      group: 'Text to Video',
      displayName: 'H3 LoRA',
      pricing: { unit: 'seconds', unitPriceUsd: 0.05 },
      inputs: [
        { name: 'prompt', type: 'string', label: 'Prompt', required: true },
        {
          name: 'loras',
          type: 'object-array',
          label: 'LoRAs',
          required: true,
          min: 1,
          max: 3,
          fields: [
            { name: 'path', type: 'string', label: 'Path', required: true },
            { name: 'scale', type: 'number', label: 'Strength', default: 1, min: 0, max: 4 },
          ],
          ...over,
        },
      ],
    })

  const parse = (loras: unknown) =>
    buildInputSchema(withLoras()).safeParse({ prompt: 'a kite', loras })

  it('takes a row whose columns are right', () => {
    expect(parse([{ path: 'user/style', scale: 0.8 }]).success).toBe(true)
    // The column's own default fills in, the same as a top level control.
    expect(parse([{ path: 'user/style' }]).success).toBe(true)
  })

  it('refuses a column the endpoint has never heard of', () => {
    // Strict, like the payload: a 422 from fal does not say which row it was.
    expect(parse([{ path: 'user/style', weight: 2 }]).success).toBe(false)
  })

  it('holds each column to its own bounds', () => {
    expect(parse([{ path: 'user/style', scale: 9 }]).success).toBe(false)
  })

  it('bounds how many rows there may be', () => {
    expect(parse([]).success).toBe(false)
    expect(parse(Array(4).fill({ path: 'user/style' })).success).toBe(false)
    expect(parse(Array(3).fill({ path: 'user/style' })).success).toBe(true)
  })

  it('insists on the list when the endpoint cannot run without one', () => {
    expect(buildInputSchema(withLoras()).safeParse({ prompt: 'a kite' }).success).toBe(false)
  })
})
