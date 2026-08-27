/**
 * The zod schemas themselves live with the domain they describe:
 * `canvasGenerationRequest` in @genny/models, `falKeyInput` in @genny/fal. This
 * file only carries the shape the client receives back.
 *
 * That split is also what keeps zod out of apps/web entirely.
 */
export type GenerationResult =
  | {
      ok: true
      jobId: string
      /** One per reserved output, in order. Empty only if it lost a race it cannot lose. */
      nodeIds: string[]
      /** References the chosen model could not take. Shown, never silent. */
      dropped?: string[]
    }
  | { ok: false; reason: string; retryable: boolean }
