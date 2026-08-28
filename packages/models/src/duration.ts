import type { ModelPricing } from './pricing.ts'

/**
 * Where the length of a generation usually lives, when the entry does not say.
 *
 * Shared rather than written twice: the contract rule accepted any field
 * matching `/duration|seconds/` while the estimator read `duration` and
 * `duration_seconds` only, so an endpoint calling it `seconds_total` passed the
 * check and was then estimated at the fallback forever.
 */
export const DURATION_FIELDS: readonly string[] = ['duration', 'duration_seconds']

const PER_SECOND = { seconds: 1, milliseconds: 1 / 1000, minutes: 60 } as const

/**
 * How many seconds of output to bill for.
 *
 * `parseFloat`, not `Number`: fal spells durations `5`, `"5"` and `"8s"`, and
 * the last makes `Number` return NaN. That failure is silent and permanent,
 * because the estimate becomes the hold and `settle` never captures more than
 * it held. `"auto"` is the same trap with a friendlier face, and it is the
 * default on every FLUX 3 and Seedance route.
 */
export function secondsOf(pricing: ModelPricing, input: Record<string, unknown>): number {
  const named = pricing.duration?.field
  const raw = named ? input[named] : (input.duration ?? input.duration_seconds)
  const parsed = parseFloat(String(raw))
  if (!Number.isFinite(parsed) || parsed <= 0) return pricing.duration?.assume ?? 5
  return parsed * PER_SECOND[pricing.duration?.unit ?? 'seconds']
}
