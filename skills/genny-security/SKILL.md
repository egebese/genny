---
name: genny-security
description: Use when adding a route, server action, webhook, database table, or anything touching credentials, credits or user input in genny. Covers the zod trust boundary, RLS requirements for new tables, BYOK key handling, rate limiting and webhook verification, with the exact checks to run.
---

# Security checklist

Work through this for anything that accepts input, stores data, or spends money.

## 1. Every entry point parses first

```ts
'use server'
export async function createGeneration(raw: unknown) {
  const input = createGenerationSchema.parse(raw)   // first statement, always
  ...
}
```

Applies to route handlers, server actions, webhooks and env. Model payloads use
`buildInputSchema(model)`, generated from that model's catalog entry, so the
validator matches the endpoint the payload is actually going to.

`.strict()` on payload objects. An unknown field forwarded to fal is an unknown
field you did not intend to send.

## 2. A new table that holds user data

Four things, or it does not merge:

```ts
export const things = pgTable('things', {
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ...
}, (t) => [ownerPolicy('things')]).enableRLS()
```

1. `owner_id` referencing `users.id`
2. `ownerPolicy('things')` in the table config
3. `.enableRLS()`
4. A case in `packages/db/src/rls.integration.test.ts` proving actor B cannot
   read, update or delete actor A's row

Then `pnpm db:generate` and check the migration contains both the `ENABLE ROW
LEVEL SECURITY` and the `CREATE POLICY` lines.

Every query goes through `withActor(db, actorId, fn)`. Without it the query
returns nothing, which is the correct direction to fail.

## 3. Anything key-shaped

- Never into the database, the logs or a response body
- BYOK keys are sealed with `sealKey`/`unsealKey` only
- Add the field name to `packages/env/src/redact.ts`
- Compare secrets with `secretsMatch`, never `===`

## 3b. Never put a secret in a server action argument

Next's dev logger prints action arguments, so a key passed that way is written to
the terminal in plain text.

```ts
// wrong: the key is logged by the framework
await saveFalKey({ key })

// right: a request body is not logged
await fetch('/api/session/fal-key', { method: 'POST', body: JSON.stringify({ key }) })
```

## 4. A route that costs money

```ts
const verdict = await limiter.check(ruleFor('userGeneration', actorId))
if (!verdict.allowed) return tooManyRequests(verdict.resetAt)
```

Add a rule to `packages/ratelimit/src/rules.ts` rather than inlining numbers.
Anonymous actors get a tighter limit than signed-in ones.

## 5. Anything money-touching

- An idempotency key on every ledger write, derived from the causing event
- Never `UPDATE` a ledger row; write its inverse
- Hold before the external call, capture after, refund on failure

## 6. An incoming webhook

- Verify the signature before parsing the body (fal: ED25519 against its JWKS,
  cached 24h; Stripe: its own signature scheme)
- Reject a timestamp outside a five-minute window
- Make replay a no-op through a unique key on the event id
- Return 200 for a duplicate. A retry storm is worse than a duplicate.

## 7. A user-supplied url

Scheme allowlist, and refuse private and link-local address ranges. Resolve, then
check, then fetch. A url that resolves to `169.254.169.254` is an attempt to read
cloud metadata.

## 8. A new external host

Add it to the CSP in `apps/web/next.config.ts`, deliberately, with a reason. If
it is a CDN for convenience, prefer inlining the asset instead.

## Before you open the PR

```bash
pnpm test:integration      # RLS and ledger invariants
pnpm check                 # boundary rules
```

- [ ] Entry points parse with zod
- [ ] New tenant table has owner, policy, RLS, and an isolation test
- [ ] No secret in logs or responses; new secret field added to `redact.ts`
- [ ] No secret passed as a server action argument
- [ ] Money path has an idempotency key
- [ ] Money-spending route has a rate limit rule
- [ ] Webhook verifies before it parses
- [ ] New host added to CSP on purpose
