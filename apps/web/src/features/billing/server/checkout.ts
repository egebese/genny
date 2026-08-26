import { findPlan, type PlanId, priceIdFor, TOPUP } from '@genny/billing/plans.ts'
import { stripeClient } from '@genny/billing/stripe-client.ts'
import { env } from '@genny/env/env.ts'

export type CheckoutOutcome =
  | { ok: true; url: string }
  | { ok: false; reason: string; status: number }

/**
 * Starts a Stripe checkout and makes sure the customer carries our actor id.
 *
 * The id goes on the customer rather than only on the session, because the
 * customer is the one object present on every later event: a renewal invoice
 * knows nothing about the checkout that started the subscription.
 */
export async function startCheckout(
  actorId: string,
  request: { kind: 'subscription'; plan: PlanId } | { kind: 'topup' },
): Promise<CheckoutOutcome> {
  const config = env()
  if (!config.STRIPE_SECRET_KEY) {
    return { ok: false, reason: 'Billing is not configured.', status: 404 }
  }

  const stripe = stripeClient(config.STRIPE_SECRET_KEY)
  const customer = await findOrCreateCustomer(stripe, actorId)
  const returnTo = `${config.APP_URL}/billing`

  if (request.kind === 'topup') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer,
      success_url: `${returnTo}?bought=1`,
      cancel_url: returnTo,
      // Read back by the webhook, which is the only thing that grants credits.
      metadata: { ownerId: actorId, credits: String(TOPUP.credits) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: TOPUP.priceCents,
            product_data: { name: `${TOPUP.credits.toLocaleString()} credits` },
          },
        },
      ],
    })
    return session.url ? { ok: true, url: session.url } : failed()
  }

  const plan = findPlan(request.plan)
  const price = plan ? priceIdFor(plan.id, process.env) : undefined
  if (!plan || !price) return { ok: false, reason: 'That plan is not available.', status: 400 }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    success_url: `${returnTo}?subscribed=1`,
    cancel_url: returnTo,
    line_items: [{ price, quantity: 1 }],
    // On the subscription, so every renewal invoice carries it too.
    subscription_data: { metadata: { ownerId: actorId, planId: plan.id } },
  })
  return session.url ? { ok: true, url: session.url } : failed()
}

async function findOrCreateCustomer(
  stripe: ReturnType<typeof stripeClient>,
  actorId: string,
): Promise<string> {
  const existing = await stripe.customers.search({
    query: `metadata['ownerId']:'${actorId}'`,
    limit: 1,
  })
  const found = existing.data[0]
  if (found) return found.id

  const created = await stripe.customers.create({ metadata: { ownerId: actorId } })
  return created.id
}

function failed(): CheckoutOutcome {
  return { ok: false, reason: 'Stripe did not return a checkout url.', status: 502 }
}
