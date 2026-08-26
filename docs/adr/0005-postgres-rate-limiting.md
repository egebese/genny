# 0005: rate limiting in Postgres, Redis optional

**Status:** accepted (2026-08-26)

## Context

Generation routes spend money. They need a limiter. Self-hosters should not need
a second piece of infrastructure to be safe by default.

## Decision

Fixed-window counters in one Postgres table. One statement per check: an upsert
whose conflict branch increments only while the count is below the limit, so the
statement itself is the concurrency control. Redis stays an optional accelerator
behind the same interface.

## Consequences

- A self-hosted deployment needs exactly one stateful dependency.
- Proven under load in `postgres-limiter.integration.test.ts`: 25 parallel
  requests against a limit of 5 admit exactly 5.
- Refused attempts do not inflate the counter, so a hammering client is not
  punished past its window.
- Known ceiling: a client can burst across a window boundary. Documented in the
  code rather than pretended away. Move to a sliding log only if that burst is
  measurably costing money.

## Rejected

**Upstash Redis.** A required external service for a self-hostable project.
**In-memory.** Wrong the moment there are two instances.
