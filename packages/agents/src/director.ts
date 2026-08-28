import { z } from 'zod'
import type { MemoryOutput } from './memory.ts'
import { AGENT_MODEL, type AgentDefinition, HOUSE_STYLE, priceFor } from './registry.ts'

/**
 * One turn of a conversation with a director who can also act.
 *
 * The reply is always there; the shots are there when proposing something is
 * the useful answer. Both in one shape rather than a mode the caller has to
 * pick, because "what should I do next" and "give me six hero shots" are the
 * same request said with different confidence, and making somebody choose a
 * mode first is asking them to know the answer before they ask.
 */
export const directorOutput = z.object({
  /** What to say. Two or three sentences at most. */
  reply: z.string().min(1).max(1200),
  /**
   * Prompts worth running, ready to go.
   *
   * Never run without a click. An agent that could spend money by deciding to
   * would be the only path in the product where a generation appears with no
   * rectangle waiting for it and no price ever shown.
   */
  shots: z
    .array(
      z.object({
        prompt: z.string().min(1).max(1200),
        /** Two to four words, for the chip. */
        title: z.string().min(1).max(48),
      }),
    )
    .max(6)
    .default([]),
})

export type DirectorOutput = z.infer<typeof directorOutput>

const SYSTEM = [
  HOUSE_STYLE,
  'You are the creative director on this project. You are told what the project is, what',
  'its boards have turned out to be about, and what is on the board right now.',
  'Answer the question actually asked. Do not open with a summary of what they already',
  'know, and do not end by asking whether they would like you to continue.',
  'Propose shots when shots are what was wanted: ideas for what to make next, a set to',
  'cover, a gap you can see. Every prompt must be runnable as written, describing one',
  'image or one clip, in their vocabulary and inside what the project says it is.',
  'Leave "shots" empty when they asked a question, wanted an opinion, or wanted a',
  'critique. Padding an answer with three prompts nobody asked for wastes their money.',
  'When critiquing, be specific and short: name the shot and what is wrong with it',
  'against the brief. "Consider the composition" is not a critique.',
].join(' ')

export const directorAgent: AgentDefinition<DirectorOutput> = {
  id: 'director',
  model: AGENT_MODEL,
  // Some room: this one is asked for ideas, and a director who says the same
  // four things every time is a director nobody asks twice.
  temperature: 0.7,
  vision: true,
  systemPrompt: SYSTEM,
  schema: directorOutput,
  pricing: priceFor(true),
  creditMultiplier: 1.25,
}

export type DirectorContext = {
  /** What they said. */
  question: string
  /** The project's own words, when it has any. */
  brief?: string | undefined
  /** What the board has turned out to be about. */
  memory?: MemoryOutput | undefined
  /** The prompts already on this board, newest last. */
  onBoard: readonly string[]
  /** How many of the board's results are being shown to it. */
  looking: number
}

export function directorPrompt(context: DirectorContext): string {
  const memory = context.memory
  return [
    context.brief ? `The project: ${context.brief}` : '',
    memory ? `What the boards say: ${memory.summary}` : '',
    memory && memory.preferences.length > 0 ? `Prefers: ${memory.preferences.join(', ')}` : '',
    memory && memory.avoid.length > 0 ? `Avoids: ${memory.avoid.join(', ')}` : '',
    context.onBoard.length > 0
      ? `On the board already:\n${context.onBoard.map((one) => `- ${one}`).join('\n')}`
      : 'The board is empty.',
    context.looking > 0
      ? `You are looking at ${context.looking} of the results.`
      : 'You cannot see the results, only the prompts.',
    '',
    context.question,
  ]
    .filter((line) => line !== '')
    .join('\n')
}
