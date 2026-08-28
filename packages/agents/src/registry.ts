import { type ZodType, z } from 'zod'

/**
 * What an agent is, and why it is not a catalog model.
 *
 * A catalog entry describes something that makes media: it has a modality, an
 * aspect ratio, reference slots, and a place in the picker. An agent has none
 * of those. Forcing one into the catalog would mean a fourth modality nobody
 * can generate, a pricing unit measured in tokens, and a row in the model
 * picker offering to think at you.
 *
 * What they do share is the money path, so the shape below is deliberately
 * compatible with `ChargedModel`: `creditsFor` prices an agent call with no
 * changes at all.
 */
export type AgentDefinition<T> = {
  id: AgentId
  /** Passed to the router verbatim. Not an enum on their side, so not one here. */
  model: string
  /** Low by default: these answer in a shape, and invention is not wanted. */
  temperature: number
  /** True when the agent needs to look at the media rather than read about it. */
  vision: boolean
  systemPrompt: string
  schema: ZodType<T>
  pricing: { unit: 'requests'; unitPriceUsd: number }
  creditMultiplier: number
}

export const agentId = z.enum(['variants', 'catalogue', 'memory', 'director'])
export type AgentId = z.infer<typeof agentId>

/**
 * One model for everything, until something is measurably not served by it.
 *
 * Measured on the two calls these agents actually make: 1.8s and $0.00027 for
 * text, 2.9s and $0.00052 with an image attached. Fast enough to sit in front
 * of a person waiting, cheap enough that the interesting question is latency
 * rather than cost.
 */
export const AGENT_MODEL = 'google/gemini-3.1-flash-lite'

/**
 * A flat price per call, above the worst measured cost.
 *
 * Token counts are only known once the answer exists, and the estimate is the
 * hold, so there is nothing honest to meter against up front. The alternative,
 * holding a generous ceiling and refunding the difference, buys precision worth
 * a fraction of a cent and costs a whole settlement path.
 *
 * Both numbers are roughly four times what the calls were measured at, which is
 * the room a longer board or a longer brief will eat.
 */
export const TEXT_PRICE_USD = 0.001
export const VISION_PRICE_USD = 0.002

export function priceFor(vision: boolean): AgentDefinition<unknown>['pricing'] {
  return { unit: 'requests', unitPriceUsd: vision ? VISION_PRICE_USD : TEXT_PRICE_USD }
}

/** Shared by every agent, so none of them has to be told twice. */
export const HOUSE_STYLE = [
  'You work inside a generative media studio. The person you are helping is making',
  'images, video and audio for real work, and they are paying per generation.',
  'Reply with ONLY a JSON object. No prose before it, no prose after it, no code fence.',
  'Never invent facts about their project. If the context does not say, leave the field out',
  'rather than filling it with something plausible.',
].join(' ')

/**
 * The exact shape, appended to every system prompt, generated from the schema
 * the answer is validated against.
 *
 * Written out rather than described, and generated rather than typed. Told in
 * prose what to say and not what to call it, the model answers in its own
 * vocabulary: asked for a summary of a board it returned `{"theme": ...}`,
 * which is a correct answer to the question and unusable. Deriving it from the
 * schema means the prompt cannot drift from what will be accepted, which is
 * the failure this replaces.
 */
export function shapeOf(schema: ZodType): string {
  const json = z.toJSONSchema(schema, { io: 'input' })
  const { $schema: _dropped, ...rest } = json as Record<string, unknown>
  return `Answer with exactly this shape, using exactly these field names:\n${JSON.stringify(rest)}`
}

/** The whole system prompt for one agent: what to do, then what to answer with. */
export function systemPromptFor<T>(agent: AgentDefinition<T>): string {
  return `${agent.systemPrompt}\n\n${shapeOf(agent.schema)}`
}
