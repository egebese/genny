# Phase 2: the SaaS layer

**Milestone:** M2 · **Mode:** saas

The job: someone pays, spends, and a failed generation gives the money back.

## Scope

- Auth.js v5 with Google, anonymous actors promoted rather than replaced
- Credit ledger: hold, capture, refund, grant, top-up
- Stripe: subscription checkout, top-up checkout, customer portal, webhooks
- fal webhooks: ED25519 verification against JWKS, replay protection
- Reconcile sweep: releases holds for jobs whose result never arrived
- Rate limits per plan
- Usage page: every ledger row with its cause

## Exit criteria

| # | Criterion |
|---|---|
| 2.1 | `sum(ledger.delta) = balance + hold` after a thousand randomised operations |
| 2.2 | Concurrent submits cannot overdraw a balance |
| 2.3 | A replayed Stripe webhook changes nothing |
| 2.4 | A tampered fal webhook is rejected; a replayed one is a no-op |
| 2.5 | A failed generation refunds, visibly, in the same session |
| 2.6 | A crash between hold and submit releases the hold within the sweep window |
| 2.7 | Signing in keeps everything the anonymous actor made |
| 2.8 | Insufficient credits refuses before fal is called, stating the shortfall |
| 2.9 | Stripe webhook flow covered end to end against the Stripe CLI |

## Out of scope

Teams, invoice billing, coupons, regional pricing.
