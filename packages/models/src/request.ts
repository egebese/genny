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
  /**
   * Assets pinned to a named input field, rather than left to the prompt.
   *
   * `@mention` cannot say which of two image slots it means, and a model that
   * takes both a first and a last frame is exactly the case where the order they
   * were typed in is not the answer. These win over anything the prompt mapped
   * into the same field.
   */
  attachments: z
    .array(z.object({ field: z.string().min(1).max(64), assetId: z.uuid() }))
    .max(16)
    .default([]),
  /** Values for the model's own controls. Shape checked per model. */
  settings: z.record(z.string(), z.unknown()).default({}),
})

export type GenerationRequest = z.infer<typeof generationRequest>

/**
 * Where the generation's first output goes on the board.
 *
 * The client decides, because only the browser knows the viewport and what is
 * already placed. The bounds are a sanity rail, not a layout rule: a coordinate
 * past them is a bug or an attack, never a person scrolling.
 */
export const nodeRect = z.object({
  x: z.int().min(-1_000_000).max(1_000_000),
  y: z.int().min(-1_000_000).max(1_000_000),
  width: z.int().positive().max(4000),
  height: z.int().positive().max(4000),
})

export const canvasGenerationRequest = generationRequest.extend({
  projectId: z.uuid(),
  node: nodeRect,
})

export type NodeRect = z.infer<typeof nodeRect>
export type CanvasGenerationRequest = z.infer<typeof canvasGenerationRequest>
