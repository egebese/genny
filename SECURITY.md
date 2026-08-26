# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability). Do not open a public issue.

Include what you did, what happened, and what you expected. A proof of concept
helps; a working exploit chain is not required.

Expect an acknowledgement within 72 hours and a fix or a plan within 14 days for
anything that leaks data, spends someone else's credits, or bypasses tenant
isolation.

## What we consider a vulnerability

| Severity | Examples |
|---|---|
| Critical | Reading another tenant's assets, jobs or credit balance. Extracting a BYOK fal key. Spending credits without a ledger entry. |
| High | Bypassing rate limits on a generation route. Forging an anonymous actor id. Server-side request forgery through an external asset url. |
| Medium | Stored XSS in a prompt, asset label or blog post. Leaking configuration through an error message. |
| Low | Missing security header. Verbose error text with no exploitable content. |

## Design decisions that are load-bearing

If you are auditing this project, these are the places worth your attention.

**Tenant isolation is in the database, not in the query.** The app connects as
`genny_app`, which owns no tables and has no `BYPASSRLS`. Every tenant table has
an RLS policy comparing `owner_id` against a per-transaction setting. A query
that forgets its actor context returns nothing rather than everything. See
`packages/db/src/rls.ts` and the proofs in `rls.integration.test.ts`.

**The BYOK key never lands in storage.** It is sealed with AES-256-GCM including
its own expiry, so a client cannot extend its lifetime by editing a cookie
attribute. See `packages/fal/src/key-cipher.ts`.

**Credits are a ledger, not a counter.** `genny_app` holds no UPDATE or DELETE
grant on `credit_ledger`. Corrections are new rows. Every write carries a unique
idempotency key.

**Rate limiting is one atomic statement.** The conditional increment means a
parallel burst cannot each read "one left" and all proceed. See the concurrency
test in `packages/ratelimit`.

## Out of scope

- Vulnerabilities in fal, Stripe or Postgres themselves. Report those upstream.
- Anything requiring a compromised `.env` or database credentials.
- Rate limiting of a self-hosted instance you control.
