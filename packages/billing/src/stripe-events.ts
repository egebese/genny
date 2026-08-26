import type Stripe from 'stripe'
import { findPlan, TOPUP } from './plans.ts'

export type CreditGrant = {
  credits: number
  kind: 'grant' | 'topup'
  /** Derived from the Stripe object, so redelivery grants once. */
  idempotencyKey: string
  note: string
}

/**
 * Decides what a Stripe event is worth in credits, and nothing else.
 *
 * Pure on purpose. Stripe redelivers events, sometimes days later and sometimes
 * out of order, so this mapping is the part that has to be exactly right and the
 * part worth testing without a network.
 *
 * Who the credits belong to is deliberately not decided here: that needs a lookup
 * against the Stripe customer, which is the handler's job. This function answers
 * "how much, and under what key".
 *
 * Returns null for events we do not act on, which is most of them.
 */
export function grantForEvent(event: Stripe.Event): CreditGrant | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    /*
     * A subscription checkout is granted by the invoice that follows it. Acting
     * on both would grant the first month twice.
     */
    if (session.mode === 'subscription') return null
    if (session.payment_status !== 'paid') return null

    const credits = Number(session.metadata?.credits ?? TOPUP.credits)
    if (!Number.isFinite(credits) || credits <= 0) return null

    return {
      credits,
      kind: 'topup',
      idempotencyKey: `stripe:${event.id}`,
      note: 'credit top-up',
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice

    /*
     * The subscription's metadata, not the invoice's own. We write planId when
     * the subscription is created, and Stripe reflects it onto each invoice
     * under parent.subscription_details; invoice.metadata stays empty, so
     * reading that grants nobody anything and does it silently.
     */
    const metadata = invoice.parent?.subscription_details?.metadata ?? invoice.metadata
    const plan = findPlan(metadata?.planId ?? '')
    if (!plan) return null

    return {
      credits: plan.credits,
      kind: 'grant',
      // The invoice id, not the event id: a redelivered invoice is the same
      // month's allowance and must not grant twice.
      idempotencyKey: `stripe:invoice:${invoice.id}`,
      note: `${plan.name} allowance`,
    }
  }

  return null
}

/**
 * The Stripe customer carrying our actor id. Written when the customer is
 * created, read back on every event, because that is the one identifier present
 * on every object Stripe sends.
 */
export function customerIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as { customer?: string | { id: string } | null }
  const customer = object.customer
  if (typeof customer === 'string') return customer
  return customer?.id ?? null
}

/**
 * Which plan an event says the customer is now on, or null to say they are on
 * none. Undefined for events that say nothing about it, which is most of them.
 *
 * Separate from the credit grant because the two answer to different things: a
 * renewal grants credits and confirms the plan, while a cancellation grants
 * nothing and still has to be acted on.
 */
export function planChangeForEvent(event: Stripe.Event): { planId: string | null } | undefined {
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice
    const metadata = invoice.parent?.subscription_details?.metadata ?? invoice.metadata
    const plan = findPlan(metadata?.planId ?? '')
    return plan ? { planId: plan.id } : undefined
  }

  if (event.type === 'customer.subscription.deleted') {
    // The subscription is over, so the rate limit tier goes back to free. Credits
    // already granted stay: they were paid for.
    return { planId: null }
  }

  return undefined
}
