import { recordChange } from '@genny/billing/ledger.ts'
import { stripeClient, verifyWebhook } from '@genny/billing/stripe-client.ts'
import { customerIdOf, grantForEvent } from '@genny/billing/stripe-events.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'

/**
 * Grants credits when Stripe says money arrived.
 *
 * Every answer is 200 once the signature checks out, including for events we
 * ignore and for a redelivery we have already applied. A non-2xx makes Stripe
 * retry, and retrying something that already worked is how a webhook storm
 * starts.
 */
export async function POST(request: Request): Promise<Response> {
  const config = env()
  if (config.GENNY_MODE !== 'saas' || !config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    return new Response('billing is not configured', { status: 404 })
  }

  // The raw bytes, exactly as they arrived: Stripe signs those, and re-serialising
  // parsed JSON changes the signature.
  const rawBody = await request.text()
  const verified = verifyWebhook(
    config.STRIPE_SECRET_KEY,
    config.STRIPE_WEBHOOK_SECRET,
    rawBody,
    request.headers.get('stripe-signature'),
  )
  if (!verified.ok) return new Response(verified.reason, { status: 400 })

  const grant = grantForEvent(verified.event)
  if (!grant) return Response.json({ ok: true, ignored: verified.event.type })

  const ownerId = await ownerFor(config.STRIPE_SECRET_KEY, verified.event)
  if (!ownerId) {
    // Money arrived for a customer we cannot place. Answering 200 stops the
    // retries; the ledger simply has no row, which is visible in reconciliation.
    console.error('[stripe] paid event with no owner', verified.event.id, verified.event.type)
    return Response.json({ ok: true, unmatched: true })
  }

  await recordChange(ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL), {
    ownerId,
    delta: String(grant.credits),
    kind: grant.kind,
    idempotencyKey: grant.idempotencyKey,
    note: grant.note,
  })
  return Response.json({ ok: true })
}

/**
 * Our actor id lives on the Stripe customer, because that is the one identifier
 * present on every object Stripe sends about a purchase.
 */
async function ownerFor(secretKey: string, event: Parameters<typeof grantForEvent>[0]) {
  const customerId = customerIdOf(event)
  if (!customerId) return null

  const customer = await stripeClient(secretKey).customers.retrieve(customerId)
  if (customer.deleted) return null
  return customer.metadata?.ownerId ?? null
}
