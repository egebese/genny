# Self-hosting

genny is a Next app and a Postgres database. Everything else is optional.

## Minimum

| Required | Why |
|---|---|
| Postgres 16+ | The only stateful dependency |
| S3-compatible bucket | fal keeps generated media about a week; assets need a permanent home |
| Node 22+ runtime | Or any container host |

Not required: Vercel, Supabase, Redis, a queue, a second service.

## Roles

Two database roles, created by `docker/init/01-roles.sql` in development. On a
managed database, create them by hand:

```sql
CREATE ROLE genny_migrator LOGIN PASSWORD '...';
CREATE ROLE genny_app LOGIN PASSWORD '...';
GRANT ALL ON SCHEMA public TO genny_migrator;
GRANT USAGE ON SCHEMA public TO genny_app;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE <db> TO genny_migrator;
GRANT CONNECT ON DATABASE <db> TO genny_app;
```

`genny_app` must not have `BYPASSRLS` and must not own the tables. That
separation is what makes row-level security a boundary rather than a comment.
`pnpm db:migrate` re-applies grants after every migration, so a new table is
never accidentally invisible or accidentally writable.

## Using Supabase

Point `DATABASE_URL` at Supabase's pooled connection string and
`DATABASE_MIGRATION_URL` at the direct one. Nothing in the codebase imports a
Supabase SDK, so it is a Postgres like any other. Its storage works too: it
speaks the S3 API, so the same `S3_*` variables apply.

## Choosing a mode

```bash
GENNY_MODE=byok    # public demo. no credits, no billing, no accounts needed
GENNY_MODE=saas    # requires FAL_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

The app refuses to boot in `saas` mode without those, listing every missing one
at once. That is deliberate: discovering a missing Stripe secret at the first
paid generation is worse than discovering it at deploy.

## Pricing and margin

```bash
CREDIT_PER_USD=1000        # 1 USD of fal spend = 1000 credits sold
```

Per-model markup lives in each catalog file (`creditMultiplier`) and can be
overridden per model from the admin panel. Your margin is those two numbers.

## Stripe

Three recurring prices, one per plan in `packages/billing/src/plans.ts`, created
in your own Stripe account. Their ids go in `STRIPE_PRICE_STARTER`,
`STRIPE_PRICE_CREATIVE` and `STRIPE_PRICE_STUDIO`. A plan whose price id is
missing is not offered, so you can ship two plans instead of three by leaving
one blank.

Point a webhook endpoint at `/api/webhooks/stripe` and subscribe it to exactly
two events:

```
checkout.session.completed    # one-off top-ups
invoice.paid                  # the first subscription month and every renewal
```

Subscriptions are granted by the invoice, never by the checkout, because a
renewal three months from now produces an invoice and no checkout. Every grant
is keyed on the Stripe object id, so a redelivered webhook credits nobody twice.

Test it before taking money: `stripe listen --forward-to
localhost:3000/api/webhooks/stripe` prints a signing secret for
`STRIPE_WEBHOOK_SECRET`, and `stripe trigger invoice.paid` walks the whole path.

## Media never comes from the bucket

`S3_PUBLIC_URL` is what the server uses to reach storage. It is not what the
browser is given: every asset is served from `/api/assets/<id>/<name>` on the
app's own origin.

That is not indirection for its own sake. A url naming the bucket breaks in
three ordinary situations: opening the studio over a LAN address or a tunnel
(the browser resolves the bucket host against itself, and Chrome refuses a
public page fetching from loopback outright), a bucket that is not
world-readable, which is the sane default on S3 and R2, and any deployment that
forgot to add the bucket origin to its CSP.

It also means RLS decides who may read a file, rather than a bucket policy
nobody remembers configuring. Range requests are passed through, so video
seeks.

The cost is that media flows through the app. If that becomes the bottleneck,
put a CDN in front of the route rather than exposing the bucket.

## Operational chores

| Chore | Frequency | Why |
|---|---|---|
| `pnpm catalog:sync --check` | weekly | fal prices change; a silent change eats your margin |
| Prune rate-limit buckets | hourly | finished windows are dead weight |
| Reconcile stuck jobs | every few minutes | releases credits held by a job whose result never arrived |

The first is a CI cron in this repo. Pruning rate-limit buckets is still phase 2.

### fal webhooks

Nothing to configure. When `APP_URL` is a public https address and the mode is
saas, each submission registers `POST /api/webhooks/fal` and the result lands
the moment fal has it, whether or not a browser is still watching. Locally, or
on a private host, the URL is not registered at all: fal dials in from the
internet, and a callback address it cannot reach is worse than none.

Deliveries are verified as ED25519 against fal's published keys
(`rest.fal.ai/.well-known/jwks.json`, cached for a day) with a five minute
timestamp window. Every rejection answers the same way, since a verifier that
explains itself is a tool for finding a valid signature.

The webhook, the browser's stream and the sweep can all reach the same finished
job. The first to claim it in `jobs.settling_at` is the one that ingests the
outputs; the others report what it wrote.

### Reconciling stuck jobs

A generation is driven by the stream the browser holds open. Close the tab and
the row stays `queued` with its credits reserved, because nothing else ever
revisits it. `POST /api/cron/reconcile` is what revisits it.

```bash
CRON_SECRET=$(openssl rand -hex 32)   # leave it unset and the route 404s
```

```
* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://your-host/api/cron/reconcile
```

GET works too, since most hosted schedulers only send GET. Every minute is
plenty; every hour still beats never.

Where the deployment owns the fal key the sweep settles the job for real,
ingesting the outputs and capturing what the run actually cost. In byok it can
only expire: the key belonged to the visitor and left with them. Either way, a
job with nothing to show for it an hour later has its credits returned, because
neither finished nor refunded is the one outcome a user cannot recover from.

## Backups

Back up Postgres. The bucket holds regenerable media; the database holds the
ledger, and the ledger is the part you cannot reconstruct.
