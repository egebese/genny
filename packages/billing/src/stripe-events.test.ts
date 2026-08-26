import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { PLANS, TOPUP } from './plans.ts'
import { customerIdOf, grantForEvent } from './stripe-events.ts'

const event = (type: string, object: unknown, id = 'evt_1'): Stripe.Event =>
  ({ id, type, data: { object } }) as Stripe.Event

describe('grantForEvent', () => {
  it('grants a top-up for a paid one-off checkout', () => {
    const grant = grantForEvent(
      event('checkout.session.completed', {
        mode: 'payment',
        payment_status: 'paid',
        metadata: { credits: '10000' },
      }),
    )
    expect(grant).toMatchObject({ credits: 10_000, kind: 'topup', idempotencyKey: 'stripe:evt_1' })
  })

  it('falls back to the standard top-up size when the metadata is missing', () => {
    const grant = grantForEvent(
      event('checkout.session.completed', {
        mode: 'payment',
        payment_status: 'paid',
        metadata: {},
      }),
    )
    expect(grant?.credits).toBe(TOPUP.credits)
  })

  it('ignores an unpaid checkout', () => {
    expect(
      grantForEvent(
        event('checkout.session.completed', { mode: 'payment', payment_status: 'unpaid' }),
      ),
    ).toBeNull()
  })

  it('ignores a subscription checkout, because the invoice grants it', () => {
    expect(
      grantForEvent(
        event('checkout.session.completed', { mode: 'subscription', payment_status: 'paid' }),
      ),
    ).toBeNull()
  })

  it('grants a plan allowance for a paid invoice', () => {
    const plan = PLANS[1]
    const grant = grantForEvent(
      event('invoice.paid', { id: 'in_9', metadata: { planId: plan?.id } }),
    )
    expect(grant).toMatchObject({
      credits: plan?.credits,
      kind: 'grant',
      idempotencyKey: 'stripe:invoice:in_9',
    })
  })

  it('keys an allowance on the invoice, so a redelivered event grants once', () => {
    const object = { id: 'in_9', metadata: { planId: 'starter' } }
    const first = grantForEvent(event('invoice.paid', object, 'evt_a'))
    const second = grantForEvent(event('invoice.paid', object, 'evt_b'))
    expect(first?.idempotencyKey).toBe(second?.idempotencyKey)
  })

  it('ignores an invoice for a plan it does not recognise', () => {
    expect(
      grantForEvent(event('invoice.paid', { id: 'in_9', metadata: { planId: 'gone' } })),
    ).toBeNull()
  })

  it('ignores an invoice with no plan at all', () => {
    expect(grantForEvent(event('invoice.paid', { id: 'in_9', metadata: {} }))).toBeNull()
  })

  it('ignores everything else Stripe sends', () => {
    for (const type of [
      'customer.created',
      'payment_intent.succeeded',
      'invoice.payment_failed',
      'customer.subscription.deleted',
    ]) {
      expect(grantForEvent(event(type, { id: 'x' }))).toBeNull()
    }
  })

  it('refuses a nonsensical credit amount rather than granting it', () => {
    for (const credits of ['0', '-100', 'lots', '']) {
      expect(
        grantForEvent(
          event('checkout.session.completed', {
            mode: 'payment',
            payment_status: 'paid',
            metadata: { credits },
          }),
        ),
      ).toBeNull()
    }
  })
})

describe('customerIdOf', () => {
  it('reads a customer given as an id or as an object', () => {
    expect(customerIdOf(event('invoice.paid', { customer: 'cus_1' }))).toBe('cus_1')
    expect(customerIdOf(event('invoice.paid', { customer: { id: 'cus_2' } }))).toBe('cus_2')
  })

  it('returns null when there is no customer', () => {
    expect(customerIdOf(event('invoice.paid', {}))).toBeNull()
    expect(customerIdOf(event('invoice.paid', { customer: null }))).toBeNull()
  })
})
