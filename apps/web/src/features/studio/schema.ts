import { z } from 'zod'

/**
 * What the client is allowed to send. Model-specific fields are validated
 * separately against a schema built from that model's catalog entry, because a
 * shared schema for every model would have to accept the union of every field.
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

export const falKeyInput = z.object({
  /*
   * Deliberately loose. A real fal key turned out to be 134 characters across
   * three colon-separated parts including base64 padding, not the `id:secret`
   * pair the docs' examples suggest. Guessing the shape rejected valid keys, so
   * the only checks here are the ones that cannot be wrong: some length, no
   * whitespace. Whether the key actually works is decided by asking fal.
   */
  key: z
    .string()
    .trim()
    .min(20)
    .max(500)
    .refine((value) => !/\s/.test(value), 'A fal key contains no spaces.'),
})

export type GenerationResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: string; retryable: boolean }
