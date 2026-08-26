export type LimitRule = {
  /** What is being limited: an ip, an actor, an actor plus an endpoint. */
  bucket: string
  /** Requests permitted per window. */
  limit: number
  windowSeconds: number
}

export type LimitVerdict = {
  allowed: boolean
  /** Requests left in the current window. Zero once the limit is reached. */
  remaining: number
  /** When the current window ends, for a Retry-After header. */
  resetAt: Date
}

/**
 * A fixed window, not a sliding one. A sliding window costs a sorted set per
 * bucket; a fixed window costs one row and one statement, and the failure mode is
 * that someone can burst at a window boundary. For protecting a paid GPU call
 * from a runaway loop, that trade is fine, and the ceiling is documented rather
 * than pretended away.
 *
 * ponytail: fixed window; move to a sliding log only if boundary bursts are
 * measurably costing money.
 */
export type Limiter = {
  check: (rule: LimitRule) => Promise<LimitVerdict>
}
