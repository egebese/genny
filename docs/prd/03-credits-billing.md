# PRD: credits and billing (saas mode)

## Principles

1. A generation that fails costs nothing.
2. The same event processed twice charges once.
3. Every balance can be explained by rows, not by a number.

## Model

```
credit_ledger   append-only, signed deltas, unique idempotency key
credit_balance  cached balance + hold, the row a spend serializes on
```

Lifecycle: **hold** at submit, **capture** on completion at real cost,
**refund** on failure or overestimate.

Invariant, asserted in tests: `sum(ledger.delta) = balance + hold_balance`.

## Pricing

```
credits = ceil(fal_unit_price × units × model_multiplier × CREDIT_PER_USD)
```

`CREDIT_PER_USD` is one environment variable, so a white-label operator sets
their margin once. `model_multiplier` handles the per-model exception, editable
from the admin panel without a release.

Rounding is always up. Selling a fraction of a cent at a loss, a hundred thousand
times, is a real number.

## Plans

Subscription grants a monthly allowance. Top-ups are one-off purchases that do
not expire. Allowance resets; top-up does not. Spend takes allowance first, so a
purchased balance survives the month.

## Requirements

| # | Requirement |
|---|---|
| C1 | Insufficient credits refuses before calling fal, with the shortfall stated |
| C2 | Concurrent submits cannot overdraw: one wins, the other gets a clean refusal |
| C3 | A replayed Stripe webhook is a no-op |
| C4 | A crash between hold and submit releases the hold within the reconcile window |
| C5 | Real cost differing from the estimate settles by refund, never by silent absorption |
| C6 | A usage page shows every ledger row with its cause |
| C7 | Failed fal requests (5xx) are never charged |

## Stripe surface

Subscription checkout, top-up checkout, customer portal for payment method and
cancellation, and a webhook for `checkout.session.completed`,
`invoice.paid`, `customer.subscription.updated|deleted`.

Every webhook handler is idempotent on the Stripe event id. This is not defensive
programming; Stripe redelivers by design.

## Out of scope

Team pooling, invoice billing, regional pricing, usage-based invoicing, coupons.
