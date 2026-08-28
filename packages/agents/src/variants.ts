import { z } from 'zod'
import { AGENT_MODEL, type AgentDefinition, HOUSE_STYLE, priceFor } from './registry.ts'

/**
 * Variants of something that already exists.
 *
 * The agent sees the image and the prompt that made it, and writes prompts for
 * an editing model that will be handed the same image. That framing is the
 * whole design: it is not asked for four new pictures, it is asked what to
 * change about this one. A model given the original prompt alone drifts, and
 * four unrelated images are not variants of anything.
 */
export const variantOutput = z.object({
  variants: z
    .array(
      z.object({
        /** The instruction, written for an editing model looking at the source. */
        prompt: z.string().min(1).max(1200),
        /** A few words, for the label under the node. Not a sentence. */
        change: z.string().min(1).max(60),
      }),
    )
    .min(1)
    .max(8),
})

export type VariantOutput = z.infer<typeof variantOutput>

/*
 * The example is doing most of the work here.
 *
 * Told in prose to write edit instructions, the model answered with rewritten
 * versions of the original prompt ("a single golden yellow leaf on wet slate,
 * overhead") and put a whole sentence in the label. One worked pair fixed both,
 * which is the usual result with a model this size: show the shape, do not
 * describe it.
 */
const SYSTEM = [
  HOUSE_STYLE,
  'You are given one image and the prompt that produced it. An editing model will be shown',
  'that same image along with your instruction, so write the change, never the whole scene.',
  'Each instruction changes exactly one thing and leaves the rest of the frame alone: a',
  'variant that changes everything is a different picture, and they already have one.',
  'Vary what is worth varying: light, angle, material, colour, time of day, mood, framing.',
  'Every instruction begins with a verb in the imperative: make, swap, relight, move,',
  'shoot, add, remove, tighten. If your instruction reads like a scene description,',
  'you have written the wrong thing and must rewrite it as a command.',
  'Never restate the original prompt. Never describe what is already there.',
  'Never change the subject itself unless the original prompt was about a style.',
  '"change" is a label of at most four words. It is not a sentence and it has no full stop.',
  'Worked example. Original prompt: "a single red leaf on wet slate, overhead". Good answer:',
  '{"variants":[',
  '{"prompt":"make the leaf golden yellow","change":"golden leaf"},',
  '{"prompt":"dry the slate so the water sheen is gone","change":"dry stone"},',
  '{"prompt":"relight with hard low sun from the left","change":"hard low sun"}]}',
  'A bad answer repeats the scene: {"prompt":"a single golden leaf on wet slate, overhead"}.',
  'Answer with exactly the number of variants asked for.',
].join(' ')

export const variantAgent: AgentDefinition<VariantOutput> = {
  id: 'variants',
  model: AGENT_MODEL,
  /*
   * Moderate, not high. The spread wanted is in *what* changes, and 0.9 bought
   * spread in how the sentence was phrased instead: two runs in three came back
   * describing the whole scene rather than the change, and which two varied per
   * run.
   */
  temperature: 0.6,
  vision: true,
  systemPrompt: SYSTEM,
  schema: variantOutput,
  pricing: priceFor(true),
  creditMultiplier: 1.25,
}

/** What the agent is told about this particular node. */
export function variantPrompt(input: { originalPrompt: string; count: number }): string {
  return [
    `The prompt that made this image: ${input.originalPrompt}`,
    `Write exactly ${input.count} variant instructions.`,
  ].join('\n')
}
