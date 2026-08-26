import { z } from 'zod'

/** How fal bills the endpoint. Drives both the estimate and the final charge. */
export const pricingUnit = z.enum(['images', 'seconds', 'megapixels', 'requests', 'minutes'])

/**
 * Where an @mention lands in the model payload. Each model decides this for
 * itself, which is what keeps adding a model out of the UI code: the mention
 * component never learns that one endpoint wants `image_url` and another wants
 * `image_urls`.
 */
export const referenceMapping = z.object({
  /** Input field that receives the reference url(s). */
  field: z.string().min(1),
  /** true when the field is an array of urls rather than a single one. */
  array: z.boolean().default(false),
  /** Hard cap from the model's own schema. Extra references are dropped, loudly. */
  maxCount: z.int().positive().default(1),
  /**
   * What to do with the `@label` token in the prompt text once its url has been
   * mapped. Some models read the name as a subject cue, others just see noise.
   */
  token: z.enum(['strip', 'keep-label']).default('strip'),
})

/** A single control we expose in the studio for this model. */
export const modelInput = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'integer', 'number', 'boolean', 'enum']),
  label: z.string().min(1),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Hidden inputs are sent but never rendered, for things like safety flags. */
  hidden: z.boolean().default(false),
})

export const modelDefinition = z.object({
  endpointId: z.string().min(1),
  modality: z.enum(['image', 'video', 'audio']),
  /** Studio grouping in the picker, e.g. "Text to Image", "Editing". */
  group: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().default(''),
  thumbnailUrl: z.url().optional(),
  featured: z.boolean().default(false),
  sortOrder: z.int().default(0),
  pricing: z.object({ unit: pricingUnit, unitPriceUsd: z.number().nonnegative() }),
  /** Multiplier applied on top of the fal price. 1 means we resell at cost. */
  creditMultiplier: z.number().positive().default(1),
  inputs: z.array(modelInput).min(1),
  references: z.array(referenceMapping).default([]),
  capabilities: z
    .object({
      supportsNegativePrompt: z.boolean().default(false),
      supportsSeed: z.boolean().default(false),
      maxOutputs: z.int().positive().default(1),
    })
    // prefault, not default: the inner fields carry their own defaults, so an
    // absent `capabilities` object is parsed as `{}` and filled in from there.
    .prefault({}),
})

export type ModelDefinition = z.infer<typeof modelDefinition>
export type ModelInput = z.infer<typeof modelInput>
export type ReferenceMapping = z.infer<typeof referenceMapping>
