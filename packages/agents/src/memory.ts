import { z } from 'zod'
import { AGENT_MODEL, type AgentDefinition, HOUSE_STYLE, priceFor } from './registry.ts'

/**
 * What a board has turned out to be about.
 *
 * Nobody writes a brief before they start. They type forty prompts, keep six
 * results and abandon the rest, and somewhere in that is a project with a
 * subject, a look and a set of things they keep steering away from. This reads
 * it back to them rather than asking them to have known it in advance.
 */
export const memoryOutput = z.object({
  /** One or two sentences. What this board is for. */
  summary: z.string().min(1).max(600),
  /** Things that keep appearing. Nouns, not adjectives. */
  subjects: z.array(z.string().min(1).max(60)).max(8),
  /** How they want it to look, in their own vocabulary where possible. */
  preferences: z.array(z.string().min(1).max(120)).max(8),
  /**
   * What they steer away from.
   *
   * The most useful half and the easiest to miss: a prompt rewritten three
   * times to remove the same thing says more than one written once.
   */
  avoid: z.array(z.string().min(1).max(120)).max(8),
})

export type MemoryOutput = z.infer<typeof memoryOutput>

const SYSTEM = [
  HOUSE_STYLE,
  'You are given the prompts from one board, in order, and which of the results were',
  'used again afterwards. Say what this board has turned out to be about.',
  'Reuse is the strongest signal you have: something attached to a later generation was',
  'kept, and something generated once and never touched again was not.',
  'Repetition is the second: a phrase that survives twenty prompts is a preference, and',
  'a phrase tried once is not.',
  '"avoid" is for what they steer away from, which you read from what changed between',
  'consecutive prompts and from negative wording. If nothing suggests one, leave it empty.',
  'Write in their vocabulary, not in yours. If they say "flat light" do not say',
  '"diffuse illumination". Never guess at a client, a brand or a deadline: none of that',
  'is in what you were given.',
].join(' ')

export const memoryAgent: AgentDefinition<MemoryOutput> = {
  id: 'memory',
  model: AGENT_MODEL,
  // A reading of evidence, not an invention. Two runs over the same board
  // disagreeing about what it is would make the memory worth nothing.
  temperature: 0.2,
  vision: false,
  systemPrompt: SYSTEM,
  schema: memoryOutput,
  pricing: priceFor(false),
  creditMultiplier: 1.25,
}

export type MemoryEvidence = {
  prompt: string
  model: string
  /** True when something this generation produced was later handed to a model. */
  reused: boolean
}

/** What the agent is told about this particular board. */
export function memoryPrompt(input: {
  evidence: readonly MemoryEvidence[]
  brief?: string | undefined
  previous?: MemoryOutput | undefined
}): string {
  const lines = input.evidence.map(
    (one, at) => `${at + 1}. [${one.model}]${one.reused ? ' [kept]' : ''} ${one.prompt}`,
  )
  return [
    input.brief ? `The project says it is about: ${input.brief}` : '',
    input.previous
      ? `Last time you read this board: ${input.previous.summary}\nRevise it; do not start over.`
      : '',
    'Prompts on this board, oldest first:',
    ...lines,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** Every tenth node. Often enough to stay current, rare enough to be free. */
export const EVERY = 10

/**
 * Whether a board is due to be read back.
 *
 * On the tenth node, the twentieth, and so on, and never twice for the same
 * ten: a reading records how many nodes the board held, so the comparison is
 * between which block of ten this is and which block the last reading covered.
 * Comparing counts directly would re-read on every node after the tenth.
 */
export function isDue(nodeCount: number, lastReadAt: number | null): boolean {
  if (nodeCount < EVERY) return false
  return Math.floor(nodeCount / EVERY) > Math.floor((lastReadAt ?? 0) / EVERY)
}
