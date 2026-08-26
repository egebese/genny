import Stripe from 'stripe'

let cached: { key: string; client: Stripe } | undefined

/** One client per key, reused. Nothing here is specific to our account. */
export function stripeClient(secretKey: string): Stripe {
  if (cached?.key !== secretKey) {
    cached = { key: secretKey, client: new Stripe(secretKey, { typescript: true }) }
  }
  return cached.client
}

export type VerifiedEvent = { ok: true; event: Stripe.Event } | { ok: false; reason: string }

/**
 * Verifies a webhook before anything reads it.
 *
 * Stripe signs with the raw body, so the caller must pass the bytes exactly as
 * they arrived: parsing the JSON first and re-serialising it changes the
 * signature and every event is rejected for no visible reason.
 */
export function verifyWebhook(
  secretKey: string,
  webhookSecret: string,
  rawBody: string,
  signature: string | null,
): VerifiedEvent {
  if (!signature) return { ok: false, reason: 'missing signature' }
  try {
    return {
      ok: true,
      event: stripeClient(secretKey).webhooks.constructEvent(rawBody, signature, webhookSecret),
    }
  } catch (error) {
    // Deliberately coarse: a caller learning *why* a signature failed learns how
    // to forge one.
    return { ok: false, reason: error instanceof Error ? 'invalid signature' : 'unverifiable' }
  }
}
