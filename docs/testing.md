# Testing

## The layers, and what each one is allowed to prove

| Layer | Runs | Proves |
|---|---|---|
| Unit | `pnpm test` | Domain logic. Credit maths, reference mapping, catalog parsing, key sealing, actor signing. |
| Integration | `pnpm test:integration` | Anything involving Postgres, against a real Postgres via testcontainers. RLS isolation, ledger invariants, limiter atomicity. |
| E2E | `pnpm e2e` | User-visible flows, in both modes, on desktop and phone viewports. fal is mocked. |
| Live smoke | `E2E_LIVE=1 pnpm e2e` | That a real generation works end to end against a real fal key. Nightly, one cheap model. |

## Why integration tests use a real database

An RLS policy is a string that Postgres evaluates. A mock cannot evaluate it, so
a mocked test proves the mock works. The suite spins up `postgres:17-alpine`,
mounts the same `docker/init/01-roles.sql` the dev stack uses, runs the real
migrations, and connects as both `genny_app` and `genny_migrator`.

Container startup is about two seconds and shared across a file via `beforeAll`.

## The e2e mode matrix

`byok` and `saas` differ in who pays and whether credits exist. Every scenario
runs under both, because a change that only works in one mode is the failure this
architecture is most exposed to:

```bash
GENNY_MODE=byok pnpm e2e
GENNY_MODE=saas pnpm e2e
```

Each mode runs on a desktop and an iPhone viewport. Mobile is not a reduced
subset; it is the same scenarios.

## Tests that spend money

Anything hitting real fal is tagged `@live` and excluded unless `E2E_LIVE=1`. A
contributor running `pnpm e2e` never spends a cent. The nightly workflow runs the
live suite against `flux/schnell`, the cheapest useful endpoint.

## What to write, and what not to

Write a test when the logic has a branch, a loop, a parser, or touches money or
security. One good failing-then-passing test beats five that restate the
implementation.

Do not write: a test that asserts a constant, a test for a one-line pass-through,
a snapshot of markup that changes every design tweak.

The tests worth copying as examples:

- `packages/db/src/rls.integration.test.ts` for a security boundary
- `packages/ratelimit/src/postgres-limiter.integration.test.ts` for concurrency
- `packages/models/src/credits.test.ts` for money
- `packages/fal/src/key-cipher.test.ts` for tampering

## CI order

`lint + typecheck` → `unit` → `integration` → `e2e` (sharded, both modes). Turbo
runs only what changed: `turbo run --filter=...[origin/main]`.

## The suite runs against a production build

`pnpm e2e` builds and starts the app rather than running `next dev`. Nine workers
against one dev server meant a different assertion timed out on roughly every
third run: dev compiles per request and renders slower, so the suite was
measuring the dev server. `E2E_DEV=1` puts the dev server back when you want HMR
to debug a failure.

That change surfaced a real bug on the way. Cookies took their Secure flag from
`NODE_ENV`, so a production build served over http marked them Secure and the
browser dropped every one. Chrome exempts localhost and hid it; WebKit does not,
so only the iOS project failed, and only in the production build. The flag now
comes from `APP_URL`, which is the thing that actually decides.

## A local flake that is not a flake

`reuseExistingServer` is on outside CI, so `pnpm e2e` reuses whatever server is
already running. Edit a file while the suite runs and it is serving a build that
no longer matches the tests.

If a run suddenly fails somewhere new, check whether something touched the source
first. `pnpm fix` counts.
