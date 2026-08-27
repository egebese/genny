# Security model

Threat-first, in the order things actually go wrong.

## 1. One tenant reading another's work

**Defence in the database.** The app connects as `genny_app`: owns no tables, no
`BYPASSRLS`. Every tenant table carries `owner_id` and a policy comparing it to
`app.actor_id`, set per transaction by `withActor`.

The predicate is `nullif(current_setting('app.actor_id', true), '')::uuid`. The
`nullif` is load-bearing: Postgres returns an empty string for an unset setting,
and `''::uuid` raises. Without it a query with no actor context would 500 instead
of quietly returning nothing, which hides the bug and looks like an outage.

Proven by `packages/db/src/rls.integration.test.ts` against a real Postgres:
cross-tenant select, insert with a forged owner, update, delete, no-context
access, and pooled-connection leakage.

## 2. Stealing a BYOK fal key

Someone else's key is someone else's money.

- Never written to the database. Never logged. Never in a response body.
- Sealed with AES-256-GCM. The expiry is *inside* the sealed payload, so editing
  the cookie's own `Max-Age` extends nothing.
- `unsealKey` never throws and reports only a coarse reason, so it cannot be used
  as a decrypt oracle.
- `packages/env/src/redact.ts` masks key-shaped strings even when they turn up
  under an innocent field name.

## 2b. Secrets must not travel as server action arguments

Next's development logger prints server action arguments. A fal key passed as an
action argument therefore lands in the terminal in plain text, which is how
somebody else's credential ends up in a screen share or a CI log.

Anything secret enters the server through a route handler instead, where the
request body is not logged. `POST /api/session/fal-key` exists for exactly this
reason. Found by watching the dev log during an end-to-end run, not by review.

## 3. Spending credits without paying

- Append-only ledger. `genny_app` has no UPDATE or DELETE on `credit_ledger`, by
  grant, so a bug can add history but not rewrite it.
- Every write carries a unique `idempotency_key`: a replayed Stripe webhook or a
  retried submit is a no-op.
- `jobs.fal_request_id` is unique: one fal request can never become two jobs.
- Hold before submit, capture on completion, refund on failure. A crash between
  hold and submit leaves credits held, which the reconcile sweep releases. It
  errs toward the user being briefly short rather than the operator being
  permanently short.

## 4. Burning GPU budget through a loop

Two layers: request rate per ip and per actor, and concurrency per actor. The
Postgres limiter increments conditionally in one statement, so a burst of
parallel requests cannot all decide there is room. Anonymous actors get a
tighter limit than signed-in ones, because an anonymous id costs nothing to
discard.

## 5. Injection through a prompt

Prompts are data, everywhere. They are stored as JSON, sent to fal as JSON, and
rendered as text. The prompt and its references are stored separately, so a
mention is a structured reference rather than a string to be re-parsed later.

## 6. Reaching internal services through a user-supplied url

External asset import is the one place a user hands us a url to fetch. That path
requires a scheme allowlist and a private-address block. Landing in phase 1 with
the asset importer, not before it.

## 7. Leaking configuration

`packages/env` validates every variable at boot and reports every offender at
once. `/api/health` returns per-check booleans and a one-line reason; the full
error goes to the server log. The e2e suite asserts the health response contains
no connection string and nothing base64-shaped.

## Response headers

CSP allows exactly `self`, the fal media CDN and our own bucket. No CDN, no
analytics host, no font host. `frame-ancestors 'none'`, `nosniff`, HSTS, and a
`Permissions-Policy` denying camera, microphone and geolocation.

## Checklist for a new feature

- [ ] Every entry point parses with zod as its first statement
- [ ] New tenant table has `owner_id`, `ownerPolicy()`, `.enableRLS()`, and an isolation test
- [ ] Anything money-touching has an idempotency key
- [ ] Any new external host is added to the CSP, deliberately
- [ ] New secret-shaped field is added to `redact.ts`
- [ ] Route that spends money has a rate limit rule
- [ ] Nothing secret is passed as a server action argument

## Serving stored files

Assets are served by the app, from `/api/assets/<id>/<name>`, and three things
have to hold together for that to be safe.

Nothing script-executable can be stored. An upload is typed by its magic bytes,
not by what the client claims, and the signature list has no svg, html or xml in
it. The read side then serves only a type that list can produce, derived from
the same constant so the two cannot drift; anything else is sent as an opaque
download.

`X-Content-Type-Options: nosniff` is on every response, and this path carries
its own `default-src 'none'; sandbox`, so a top-level navigation to a file can
run nothing even if the first two ever fail.

Who may read a file is decided by RLS on the assets table, not by a bucket
policy. A stranger asking for someone else's id gets the same 404 as an id that
does not exist.

