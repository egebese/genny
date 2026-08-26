---
name: genny-review
description: Use when reviewing a pull request or your own changes in genny before pushing. A prioritised review checklist covering correctness, tenancy, money, boundaries, UI rules and tests, ordered by what actually breaks in production.
---

# Review

Ordered by consequence. Stop reading at the first section that fails and fix that.

## 1. Money and tenancy (a bug here is a breach or a refund)

- [ ] A new tenant table has `owner_id`, `ownerPolicy()`, `.enableRLS()`, and an isolation test
- [ ] Every tenant query goes through `withActor`
- [ ] No integration test asserts through `database.owner` when it means `database.app`
- [ ] Every ledger write has an idempotency key derived from its causing event
- [ ] No `UPDATE` or `DELETE` against `credit_ledger`
- [ ] A failure path refunds. Trace the error branch, not just the happy one.
- [ ] Cost shown to the user matches what is charged, or the difference is refunded

## 2. Trust boundaries

- [ ] Every route handler, server action and webhook parses with zod as its first statement
- [ ] Payload objects are `.strict()`
- [ ] Webhooks verify the signature before parsing the body
- [ ] No secret in a log line, an error message or a response body
- [ ] A new secret-shaped field is in `redact.ts`
- [ ] A money-spending route has a rate limit rule
- [ ] A new external host is in the CSP on purpose

## 3. Boundaries (`pnpm check` catches these; read the diff anyway)

- [ ] No SQL outside `packages/db`
- [ ] No fal call outside `packages/fal`
- [ ] `packages/ui` imports no domain package
- [ ] `GENNY_MODE` is read only in the three factories
- [ ] No file over 200 lines
- [ ] No new `@genny/*` dependency that is not in `ALLOWED`

## 4. UI

- [ ] No dialog, sheet, drawer or modal
- [ ] No sidebar
- [ ] Colours and radii from tokens, no raw hex, no arbitrary values
- [ ] Works at 375px with no horizontal scroll
- [ ] Keyboard operable with a visible focus ring
- [ ] Registry components edited through a wrapper, not in `vendor/`

## 5. Tests

- [ ] Non-trivial logic leaves one runnable check
- [ ] The test fails without the fix. Check by reverting the fix, not by reading.
- [ ] No mocked database where a real one is available
- [ ] Nothing spends real fal credits outside a `@live` tag

## 6. Simplicity

- [ ] No abstraction with one implementation
- [ ] No new dependency where twenty lines would do
- [ ] No config for a value that never changes
- [ ] No error handling for a case that cannot happen
- [ ] Every changed line traces to the stated purpose of the PR

## Comment style

Say what breaks and how to fix it. "This bypasses RLS: call
`withActor(db, actorId, ...)`" beats "wrong". Distinguish blocking from optional
and say which.
