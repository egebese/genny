import { type ZodType, z } from 'zod'
import type { ModelDefinition, ModelInput } from './schema.ts'

/**
 * Builds a validator from the model's own declared inputs, so a payload is
 * checked against the endpoint it is actually going to. A shared "generation
 * input" schema would have to accept the union of every model's fields, which is
 * the same as accepting anything.
 */
export function buildInputSchema(model: ModelDefinition): ZodType<Record<string, unknown>> {
  const shape: Record<string, ZodType> = {}
  for (const input of model.inputs) {
    shape[input.name] = applyOptionality(input, fieldSchema(input))
  }
  // Reference fields are filled by resolvePrompt, not by the client, so they are
  // permitted here but never trusted from user input.
  for (const mapping of model.references) {
    shape[mapping.field] = mapping.array ? z.array(z.url()).optional() : z.url().optional()
  }
  return z.object(shape).strict()
}

function fieldSchema(input: ModelInput): ZodType {
  switch (input.type) {
    case 'string':
      return z.string().min(1).max(8000)
    case 'boolean':
      return z.boolean()
    case 'enum':
      // `literal` rather than `enum`: the options can be numbers, and a list
      // that mixes both is how fal spells a duration that also accepts "auto".
      return input.enum && input.enum.length > 0 ? z.literal(input.enum) : z.string().min(1)
    case 'integer':
      return bounded(z.int(), input)
    case 'number':
      return bounded(z.number(), input)
  }
}

function bounded(base: z.ZodNumber, input: ModelInput): ZodType {
  let schema = base
  if (input.min !== undefined) schema = schema.min(input.min)
  if (input.max !== undefined) schema = schema.max(input.max)
  return schema
}

/**
 * A default satisfies a required field too.
 *
 * fal marks a field required and then fills it from its own default, which is
 * a contradiction only on paper. Treating the two as exclusive meant the dock
 * had to have touched that control for the payload to validate, and the dock
 * only sends what someone changed. Every untouched generation on such a model
 * was refused before it left us, with a sentence that blamed the settings.
 */
function applyOptionality(input: ModelInput, schema: ZodType): ZodType {
  if (input.default !== undefined) return schema.default(input.default)
  return input.required ? schema : schema.optional()
}
