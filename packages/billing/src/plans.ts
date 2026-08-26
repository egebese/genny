/**
 * What money buys. Kept in code rather than in Stripe so the app can price a plan
 * without a network call, and so a white-label operator edits one file.
 *
 * The credit figures assume the default CREDIT_PER_USD of 1000, where one credit
 * is a tenth of a cent of fal spend. Each model's own multiplier is where the
 * margin lives, so the bonus below is a discount on volume, not on cost.
 */
export type PlanId = 'starter' | 'creative' | 'studio'

export type Plan = {
  id: PlanId
  name: string
  /** Monthly price in the smallest currency unit, as Stripe counts it. */
  priceCents: number
  /** Credits granted each month. */
  credits: number
  blurb: string
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceCents: 1000,
    credits: 12_000,
    blurb: 'Around 150 images on Nano Banana 2, or 4000 on FLUX schnell.',
  },
  {
    id: 'creative',
    name: 'Creative',
    priceCents: 3000,
    credits: 40_000,
    blurb: 'Around 400 images on Nano Banana 2. The one most people want.',
  },
  {
    id: 'studio',
    name: 'Studio',
    priceCents: 10_000,
    credits: 150_000,
    blurb: 'Around 1500 images on Nano Banana 2, or a lot of video later.',
  },
]

/**
 * A one-off purchase. Unlike an allowance these never expire, which is why they
 * carry no bonus: the convenience is the product.
 */
export const TOPUP = { priceCents: 1000, credits: 10_000 } as const

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id)
}

/**
 * Stripe price ids come from the environment, one per plan, because they differ
 * per Stripe account and a white-label deployment has its own. A plan with no
 * price id configured is simply not offered.
 */
export function priceIdFor(
  plan: PlanId,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[`STRIPE_PRICE_${plan.toUpperCase()}`]
}
