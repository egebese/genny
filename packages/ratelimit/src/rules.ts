import type { LimitRule } from './limiter.ts'

/**
 * The limits themselves, in one readable place. Anonymous BYOK visitors are
 * limited harder than signed-in users because an anonymous id costs nothing to
 * throw away, and generation is limited harder than reads because it is the only
 * route that spends money.
 */
export const LIMITS = {
  anonymousGeneration: { limit: 10, windowSeconds: 3600 },
  userGeneration: { limit: 60, windowSeconds: 3600 },
  upload: { limit: 60, windowSeconds: 3600 },
  read: { limit: 600, windowSeconds: 60 },
  keyAttempt: { limit: 10, windowSeconds: 900 },
} as const

export type LimitName = keyof typeof LIMITS

export function ruleFor(name: LimitName, subject: string): LimitRule {
  const preset = LIMITS[name]
  return { bucket: `${name}:${subject}`, limit: preset.limit, windowSeconds: preset.windowSeconds }
}
