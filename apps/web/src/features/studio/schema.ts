/**
 * The zod schemas themselves live with the domain they describe:
 * `generationRequest` in @genny/models, `falKeyInput` in @genny/fal. This file
 * only carries the shape the client receives back.
 *
 * That split is also what keeps zod out of apps/web entirely, which `next build`
 * turned out to require. See docs/adr/0009.
 */
export type GenerationResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: string; retryable: boolean }
