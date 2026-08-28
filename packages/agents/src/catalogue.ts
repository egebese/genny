import { z } from 'zod'
import { AGENT_MODEL, type AgentDefinition, HOUSE_STYLE, priceFor } from './registry.ts'

/**
 * What one asset actually is.
 *
 * The library names things after the file they arrived in and the prompt that
 * made them, which is a record of how something came to exist rather than of
 * what it is. Six months of that is a grid of thumbnails and a search box that
 * matches nothing anyone would think to type.
 */
export const catalogueOutput = z.object({
  /** Two to four words, for under the thumbnail. */
  shortName: z.string().min(1).max(48),
  kind: z.enum(['product', 'character', 'logo', 'scene', 'texture', 'diagram', 'other']),
  /** One sentence. What a person would say if asked what this is. */
  subject: z.string().min(1).max(240),
  /**
   * The colours actually in it, most present first. Not the brand's palette.
   *
   * The hash is added when the model leaves it off, which it does. That is a
   * formatting slip with exactly one reading, unlike a missing field, so
   * refusing the whole answer over it would throw away a good description and
   * charge for a second one that says the same thing.
   */
  palette: z
    .array(
      z
        .string()
        .transform((value) => (value.startsWith('#') ? value : `#${value}`))
        .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/)),
    )
    .max(6),
  tags: z.array(z.string().min(1).max(32)).max(10),
  /**
   * A slug for the thing depicted, not for this picture of it.
   *
   * Four shots of one hoodie share a key; a hoodie and a jacket do not. This is
   * what lets the library offer "these look like the same product" without
   * anyone having said so.
   */
  groupKey: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(48),
})

export type CatalogueOutput = z.infer<typeof catalogueOutput>

const SYSTEM = [
  HOUSE_STYLE,
  'You are given one asset and, when there is one, the prompt that produced it.',
  'Say what it is, not how it was made and not how good it looks.',
  '"shortName" is two to four words, capitalised as a title, no full stop.',
  '"kind" is exactly one of: product, character, logo, scene, texture, diagram, other.',
  'A thing being sold is a product. A person or creature that recurs is a character.',
  'A mark or wordmark is a logo. A place or a moment is a scene. A surface or pattern',
  'is a texture. A chart or a layout is a diagram. Anything else is other.',
  '"subject" is one plain sentence a person would say if asked what this is.',
  '"palette" is the colours actually present, most of the frame first, as six-digit hex',
  'each beginning with a hash, like "#3d4348".',
  '"tags" are things someone would search for: the object, the setting, the treatment.',
  '"groupKey" names the thing depicted, not this picture of it, as a lowercase slug.',
  'Four photographs of one hoodie all get "offwhite-oversize-hoodie". A hoodie and a',
  'jacket get different keys. A landscape with no recurring subject gets a key for the',
  'place or the scene, never a key that only this one image could match.',
].join(' ')

export const catalogueAgent: AgentDefinition<CatalogueOutput> = {
  id: 'catalogue',
  model: AGENT_MODEL,
  // Nearly deterministic: this is a description, and two runs over the same
  // asset disagreeing about what it is would make the library untrustworthy.
  temperature: 0.1,
  vision: true,
  systemPrompt: SYSTEM,
  schema: catalogueOutput,
  pricing: priceFor(true),
  creditMultiplier: 1.25,
}

/** What the agent is told about this particular asset. */
export function cataloguePrompt(input: {
  label: string
  madeBy?: string | undefined
  brief?: string | undefined
}): string {
  return [
    `Filed as: ${input.label}`,
    input.madeBy ? `Made from the prompt: ${input.madeBy}` : 'Uploaded, with no prompt behind it.',
    input.brief ? `The project it belongs to: ${input.brief}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}
