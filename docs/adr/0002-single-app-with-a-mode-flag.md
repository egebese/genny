# 0002: one app, `GENNY_MODE` decides which product

**Status:** accepted (2026-08-26)

## Context

Two products: a BYOK public demo and a white-label SaaS with credits and billing.
They share every screen and differ in who pays.

## Decision

One Next app. `GENNY_MODE=byok|saas` selects implementations in three factory
functions: billing, fal credentials, auth. No feature or component branches on
the mode.

## Consequences

- Feature parity is free. A studio improvement lands in both products at once.
- The e2e suite runs every scenario twice, once per mode. That is the cost, and
  it is also the thing that keeps the split honest.
- The demo deploys from the same commit as the product, so it is never a stale
  fork of it.

## Rejected

**Two apps sharing packages.** Two route trees, two layouts, two suites, and
guaranteed drift.
**Open-core with the SaaS parts in private packages.** Would have made the repo
less useful to the people most likely to contribute.
