import { z } from 'zod'

/**
 * What a client is allowed to send when asking for a generation. Model-specific
 * fields are validated separately, against a schema built from that model's own
 * catalog entry: a shared schema covering every model would have to accept the
 * union of every field, which is the same as accepting anything.
 */
export const generationRequest = z.object({
  modelId: z.string().min(1).max(200),
  prompt: z.string().min(1).max(8000),
  /** Asset and character ids the prompt mentions, resolved server side. */
  references: z
    .array(
      z.object({
        token: z.string().min(2).max(80),
        label: z.string().min(1).max(64),
        kind: z.enum(['asset', 'character']),
        id: z.uuid(),
      }),
    )
    .max(16)
    .default([]),
  /** Values for the model's own controls. Shape checked per model. */
  settings: z.record(z.string(), z.unknown()).default({}),
})

export type GenerationRequest = z.infer<typeof generationRequest>
