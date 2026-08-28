import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readSchema } from './catalog-schema.mjs'

/** An OpenAPI document shaped the way fal's are, small enough to read. */
const doc = (properties, required = [], extra = {}) => ({
  paths: {
    '/some/endpoint': {
      post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/x/In' } } } } },
      // A sibling path with no body, which every fal document has three of.
      get: {},
    },
    '/some/endpoint/requests/{id}': { get: {} },
  },
  components: { schemas: { In: { properties, required }, ...extra } },
})

test('reads the endpoint input, not a nested definition beside it', () => {
  // The compact schema returns `Row` here, which is how Kling V3 arrived with
  // a nested element's fields where its own prompt should have been.
  const { inputs } = readSchema(
    doc({ prompt: { type: 'string' } }, [], { Row: { properties: { path: { type: 'string' } } } }),
    'some/endpoint',
  )
  assert.deepEqual(
    inputs.map((input) => input.name),
    ['prompt'],
  )
})

test('keeps the bounds the compact form drops', () => {
  const { inputs } = readSchema(doc({ cfg: { type: 'number', minimum: 0, maximum: 1 } }), 'x')
  assert.deepEqual(inputs[0], { name: 'cfg', label: 'Cfg', type: 'number', min: 0, max: 1 })
})

test('unwraps the null half of an optional, and keeps its default', () => {
  const { inputs } = readSchema(
    doc({
      mode: { anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }], default: 'a' },
    }),
    'x',
  )
  assert.deepEqual(inputs[0], {
    name: 'mode',
    label: 'Mode',
    default: 'a',
    type: 'enum',
    enum: ['a', 'b'],
  })
})

test('keeps an enum of numerals as fal wrote it', () => {
  // FLUX 3 mixes them; sending "12" to an endpoint that wants 12 is a 422.
  const { inputs } = readSchema(doc({ duration: { enum: ['auto', 5, 10], default: 'auto' } }), 'x')
  assert.deepEqual(inputs[0].enum, ['auto', 5, 10])
})

test('turns an array of objects into a list of rows with its own columns', () => {
  const { inputs } = readSchema(
    doc(
      {
        loras: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: { $ref: '#/components/schemas/LoRA' },
        },
      },
      ['loras'],
      {
        LoRA: {
          properties: { path: { type: 'string' }, scale: { type: 'number' } },
          required: ['path'],
        },
      },
    ),
    'x',
  )
  assert.equal(inputs[0].type, 'object-array')
  assert.deepEqual([inputs[0].min, inputs[0].max], [1, 3])
  assert.deepEqual(
    inputs[0].fields.map((field) => [field.name, field.type, field.required ?? false]),
    [
      ['path', 'string', true],
      ['scale', 'number', false],
    ],
  )
})

test('tells a url apart from a control, and guesses what it is for', () => {
  const { inputs, references } = readSchema(
    doc(
      {
        start_image_url: { type: 'string' },
        reference_image_urls: { type: 'array', maxItems: 4, items: { type: 'string' } },
        audio_url: { type: 'string' },
        prompt: { type: 'string' },
      },
      ['start_image_url'],
    ),
    'x',
  )
  assert.deepEqual(
    inputs.map((input) => input.name),
    ['prompt'],
  )
  assert.deepEqual(
    references.map((slot) => [slot.field, slot.role, slot.accepts[0], slot.array, slot.maxCount]),
    [
      ['start_image_url', 'start-frame', 'image', false, 1],
      ['reference_image_urls', 'reference', 'image', true, 4],
      ['audio_url', 'driving-audio', 'audio', false, 1],
    ],
  )
  assert.equal(references[0].required, true)
})

test('refuses a document it cannot find one body in', () => {
  assert.throws(() => readSchema({ paths: {} }, 'x'), /0 request bodies/)
})
