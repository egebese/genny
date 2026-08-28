/**
 * fal's OpenAPI, read as a catalog entry's inputs and references.
 *
 * OpenAPI rather than `genmedia schema`'s compact form, which cannot be
 * trusted: for every Kling V3 endpoint it returns the fields of a nested
 * `$defs` element instead of the endpoint's own input, and for the LoRA
 * endpoints it returns the LoRA row and hides the prompt. It also drops every
 * `minimum` and `maximum`, so a control that fal bounds at 0..4 arrives here
 * unbounded and the dock draws a box with no rails.
 */

/** A field whose value is a url pointing at media, rather than a control. */
const URLISH = /(^|_)urls?$/

/**
 * What a slot is for, from what it is called.
 *
 * A guess, and it is marked as one: the draft is meant to be read before it
 * ships. `image_url` is a start frame on one endpoint and the thing being
 * edited on another, and no amount of name matching decides that.
 */
const ROLES = [
  [/^mask/, 'mask'],
  [/^(start|first)_?(image|frame)/, 'start-frame'],
  [/^(end|last|tail)_?(image|frame)/, 'end-frame'],
  [/^(reference|ref)_/, 'reference'],
  [/^style/, 'style-reference'],
  [/^(voice|speaker)_/, 'voice-sample'],
  [/audio/, 'driving-audio'],
]

export function roleFor(name, isArray) {
  for (const [pattern, role] of ROLES) if (pattern.test(name)) return role
  return isArray ? 'input-images' : 'source'
}

export function acceptsFor(name) {
  if (/video/.test(name)) return ['video']
  if (/audio|voice|speech/.test(name)) return ['audio']
  return ['image']
}

/**
 * The schema fal will validate the request body against.
 *
 * Through the path's own `requestBody`, which is the only place a sibling
 * cannot be mistaken for it: the compact form guesses, and for Kling V3 it
 * returns a nested element's fields instead of the endpoint's input.
 *
 * The path is looked up rather than composed, because fal's own document does
 * not always spell the endpoint the way its id does:
 * `minimax/h3/image-to-video/lora` is published at
 * `/fal-ai/minimax_h3/image-to-video/lora`. Exactly one path in the document
 * takes a body, so finding it is unambiguous even when the name is not.
 */
export function inputSchemaOf(doc, endpointId) {
  const bodies = Object.values(doc.paths ?? {})
    .map((path) => path?.post?.requestBody?.content?.['application/json']?.schema?.$ref)
    .filter(Boolean)
  if (bodies.length !== 1) {
    throw new Error(`${endpointId}: ${bodies.length} request bodies in its OpenAPI document`)
  }
  return resolve(doc, { $ref: bodies[0] })
}

function resolve(doc, node) {
  if (!node?.$ref) return node
  const name = node.$ref.split('/').pop()
  const found = doc.components?.schemas?.[name] ?? doc.$defs?.[name]
  if (!found) throw new Error(`unresolved $ref ${node.$ref}`)
  return found
}

/**
 * `anyOf [T, null]` is how fal spells an optional, and it hides the real type
 * from anything reading `.type`. Unwrapped here so every caller below sees the
 * shape rather than the wrapper.
 */
function unwrap(node) {
  const options = node.anyOf ?? node.oneOf
  if (!options) return node
  const real = options.filter((option) => option.type !== 'null')
  return real.length === 1
    ? { ...real[0], ...(node.default !== undefined ? { default: node.default } : {}) }
    : node
}

const SCALAR = { string: 'string', integer: 'integer', number: 'number', boolean: 'boolean' }

function rowsFor(doc, base, node) {
  const item = unwrap(resolve(doc, node.items ?? {}))
  if (!item.properties) return null
  const columns = Object.entries(item.properties).flatMap(([key, value]) => {
    const field = inputFor(doc, key, value, (item.required ?? []).includes(key))
    // One level. A list of lists is a different problem and fal asks for none.
    return field && field.type !== 'object-array' ? [field] : []
  })
  return {
    ...base,
    type: 'object-array',
    ...(node.minItems !== undefined ? { min: node.minItems } : {}),
    ...(node.maxItems !== undefined ? { max: node.maxItems } : {}),
    fields: columns,
  }
}

function bounds(node) {
  const out = {}
  if (node.minimum !== undefined) out.min = node.minimum
  if (node.maximum !== undefined) out.max = node.maximum
  return out
}

/** One property, as a `modelInput`, or null when it is a shape we do not draw. */
export function inputFor(doc, name, raw, required) {
  const node = unwrap(raw)
  const base = { name, label: titleOf(name), ...(required ? { required: true } : {}) }
  if (node.default !== undefined) base.default = node.default

  // `const` is an enum of one, and fal writes several that way. Read as a
  // string it becomes a text box in which the only valid value is a word
  // nobody is shown, and anything else is a 422.
  const options = node.enum ?? (node.const !== undefined ? [node.const] : null)
  if (options) return { ...base, type: 'enum', enum: options }
  if (node.type === 'array') return rowsFor(doc, base, node)
  const type = SCALAR[node.type]
  return type ? { ...base, type, ...bounds(node) } : null
}

/** A url, or a list of them, as opposed to a control. */
function slotFor(doc, name, raw, required) {
  const node = unwrap(raw)
  const array = node.type === 'array'
  const item = array ? unwrap(resolve(doc, node.items ?? {})) : null
  const holds = array ? item?.type === 'string' : node.type === 'string'
  if (!URLISH.test(name) || !holds) return null
  return {
    field: name,
    role: roleFor(name, array),
    accepts: acceptsFor(name),
    required,
    array,
    maxCount: array ? (node.maxItems ?? 1) : 1,
    token: 'strip',
  }
}

/** Every property of the input schema, split into controls and slots. */
export function readSchema(doc, endpointId) {
  const schema = inputSchemaOf(doc, endpointId)
  const required = new Set(schema.required ?? [])
  const inputs = []
  const references = []

  for (const [name, raw] of Object.entries(schema.properties ?? {})) {
    const slot = slotFor(doc, name, raw, required.has(name))
    if (slot) {
      references.push(slot)
      continue
    }
    const input = inputFor(doc, name, raw, required.has(name))
    if (input) inputs.push(input)
  }
  return { inputs, references }
}

function titleOf(name) {
  return name
    .replace(/_urls?$/, '')
    .split('_')
    .map((word, at) => (at === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}
