import type { LimitRule } from './limiter.ts'

/**
 * The limits themselves, in one readable place. Anonymous BYOK visitors are
 * limited harder than signed-in users because an anonymous id costs nothing to
 * throw away, and generation is limited harder than reads because it is the only
 * route that spends money.
 */
export const LIMITS = {
  upload: { limit: 60, windowSeconds: 3600 },
  read: { limit: 600, windowSeconds: 60 },
  keyAttempt: { limit: 10, windowSeconds: 900 },
  // Per email, which is what protects one account from being guessed at. Ten in
  // a quarter of an hour is generous for a person and useless for a script.
  signIn: { limit: 10, windowSeconds: 900 },
} as const

export type LimitName = keyof typeof LIMITS

/**
 * Generation, by what the actor is. An anonymous id costs nothing to throw away,
 * so it is held down hardest; above that the limit tracks what someone pays,
 * because a Studio subscriber throttled at a trial visitor's rate has bought
 * nothing.
 *
 * These are abuse ceilings, not quotas. Credits are what actually meter spend,
 * and every tier here is far above ordinary use.
 */
export const GENERATION_LIMITS = {
  anonymous: { limit: 10, windowSeconds: 3600 },
  free: { limit: 60, windowSeconds: 3600 },
  starter: { limit: 150, windowSeconds: 3600 },
  creative: { limit: 400, windowSeconds: 3600 },
  studio: { limit: 1200, windowSeconds: 3600 },
} as const

export type Tier = keyof typeof GENERATION_LIMITS

export function ruleFor(name: LimitName, subject: string): LimitRule {
  const preset = LIMITS[name]
  return { bucket: `${name}:${subject}`, limit: preset.limit, windowSeconds: preset.windowSeconds }
}

/**
 * An unknown tier falls back to free rather than throwing. A plan renamed in
 * Stripe should cost someone a smaller allowance for an hour, not a 500 on every
 * generation.
 */
export function generationRule(tier: string, subject: string): LimitRule {
  const preset = GENERATION_LIMITS[tier as Tier] ?? GENERATION_LIMITS.free
  // The bucket is shared across tiers on purpose: changing plan mid-hour must
  // not hand out a fresh allowance.
  return {
    bucket: `generation:${subject}`,
    limit: preset.limit,
    windowSeconds: preset.windowSeconds,
  }
}

/** What an actor's tier is, given what the database knows about them. */
export function tierOf(actor: { kind: 'anonymous' | 'registered'; planId: string | null }): Tier {
  if (actor.kind === 'anonymous') return 'anonymous'
  return actor.planId && actor.planId in GENERATION_LIMITS ? (actor.planId as Tier) : 'free'
}
