# Architecture

## The shape

```
                        apps/web
        ┌───────────────────┴────────────────────┐
   src/app (routes)                    src/features (glue)
        │                                        │
        └────────────────┬───────────────────────┘
                         ▼
   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
   │  jobs    │ billing  │  assets  │ ratelimit│   auth   │
   └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
   ┌─────────────────────────────────────────────────────┐
   │        db        │       fal       │     models     │
   └────────┬─────────┴────────┬────────┴────────────────┘
            ▼                  ▼
   ┌─────────────────────────────────────────────────────┐
   │                        env                          │
   └─────────────────────────────────────────────────────┘

   ui  ──── depends on nothing. Takes props.
```

Enforced by `tooling/src/check-deps.mjs`. Adding an edge means editing `ALLOWED`
there, which makes the change visible in review.

## Why domain packages instead of a folder in the app

Three concrete payoffs, not architecture for its own sake:

1. **They test without Next.** `packages/models` has 29 tests that run in 200ms
   with no bundler, no server, no browser.
2. **An agent can hold one in its head.** A model catalog change means reading
   `packages/models`, nothing else.
3. **The mode split stays contained.** `byok` and `saas` differ inside three
   factory functions. No route knows which one it is serving.

## Request path of a generation

```
server action                      packages
─────────────                      ────────
parse input                    →   models/input.ts      (schema from the catalog)
check the limit                →   ratelimit
hold credits                   →   billing              (no-op in byok)
resolve @mentions              →   models/references.ts (per-model field mapping)
submit                         →   fal
record the job                 →   db
─────────────
client subscribes to /api/jobs/:id/stream
  byok  → poll the fal queue
  saas  → LISTEN, plus a poll as a safety net
─────────────
on completion
  ingest the output into our bucket   →  assets
  capture or refund                   →  billing
```

Phase 1 has no webhook: the SSE route polls the fal queue. Phase 2 adds
`/api/webhooks/fal` with ED25519 verification against fal's JWKS, and keeps the
poll as a reconcile fallback so a dropped webhook cannot strand a job.

## Data model

| Table | Owner-scoped | Notes |
|---|---|---|
| `users` | self-read | one row per actor, anonymous or registered |
| `accounts`, `sessions`, `verification_tokens` | no app access at all | reached only by the Auth.js adapter's own connection |
| `assets` | yes | `label` is the `@mention` handle, unique per owner |
| `characters`, `character_assets` | yes | a named bundle of reference images |
| `jobs` | yes | `fal_request_id` unique: no double charge on a retry |
| `credit_ledger` | yes, append-only | no UPDATE or DELETE grant |
| `credit_balance` | yes | the row a spend serializes on |
| `models` | public read | operational layer over the catalog files |
| `rate_limit_buckets` | no RLS by design | infrastructure, not tenant data |

## Model catalog: files are the truth, the table is the operations

A model is defined by a JSON file in `packages/models/catalog/`. That file says
what the model is: its endpoint, its price, its inputs, and where an `@mention`
lands in its payload.

The `models` table says how we sell it today: enabled, ordered, and with a credit
multiplier an operator can change from the admin panel without a release.
`catalog_hash` makes drift between the two visible.

`pnpm catalog:sync` refreshes the files from fal through the `genmedia` CLI. It
opens a PR rather than writing to the database, because a price changing silently
is the most expensive failure this system can have.

## What is deliberately not here

- **No message queue.** Postgres holds the job rows; fal holds the queue. A
  second queue would be a second source of truth about the same work.
- **No Redis requirement.** The rate limiter is one Postgres statement. Redis is
  an optional accelerator.
- **No microservices.** One Next app, one database.
- **No modals.** A product decision that turns out to be an architecture
  decision: every surface has to be a route, which keeps state in the URL.
