# 0003: Drizzle, and tenancy enforced by Postgres

**Status:** accepted (2026-08-26)

## Context

Multi-tenant data with an untrusted client. Isolation by careful query writing
fails the first time somebody forgets a `where`.

## Decision

Drizzle ORM. Row-level security on every tenant table, declared in the schema as
`pgPolicy` so it lands in migrations. The app connects as `genny_app`, which owns
no tables and has no `BYPASSRLS`. `withActor` sets `app.actor_id` per transaction.

## Consequences

- A query that forgets its actor context returns nothing, not everything.
- Policies are reviewed as code in the same diff as the table.
- Two roles to provision when self-hosting, documented in `docs/self-hosting.md`.
- The predicate must be `nullif(current_setting(...), '')::uuid`: Postgres
  returns `''` for an unset setting and `''::uuid` raises, which would turn a
  denial into a 500. Found by a test, not by reading.

## Rejected

**Prisma.** RLS means hand-written SQL alongside the schema, so the policy and
the table drift.
**Application-level `where owner_id = ?`.** One forgotten clause is a breach.
