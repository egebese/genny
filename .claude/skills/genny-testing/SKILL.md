---
name: genny-testing
description: Use when writing or fixing tests in genny, deciding which layer a test belongs to, working with testcontainers, or debugging the two-mode e2e matrix. Covers what each layer proves, the real-Postgres requirement, and the live-test opt-in.
---

# Testing

## Pick the layer

| The thing you are testing | Layer | File |
|---|---|---|
| A calculation, parser, mapping | unit | `packages/*/src/x.test.ts` |
| Anything that touches Postgres | integration | `packages/*/src/x.integration.test.ts` |
| A flow a person performs | e2e | `e2e/tests/x.spec.ts` |
| A real fal generation | e2e, tagged `@live` | excluded unless `E2E_LIVE=1` |

```bash
pnpm test                 # unit, fast, no docker
pnpm test:integration     # spins up postgres:17-alpine
GENNY_MODE=byok pnpm e2e
GENNY_MODE=saas pnpm e2e
```

## Integration tests use a real database

An RLS policy is a string Postgres evaluates. A mock cannot evaluate it, so a
mocked test proves the mock works.

```ts
let database: TestDatabase
beforeAll(async () => { database = await startTestDatabase() }, 180_000)
afterAll(async () => { await database?.stop() })
```

`startTestDatabase()` gives you two handles, and which one you use is the test:

- `database.app` connects as `genny_app`: RLS applies. This is what the app sees.
- `database.owner` connects as `genny_migrator`: RLS does not apply. Use it only
  to set up fixtures or to assert what actually landed.

Asserting through `owner` when you meant `app` is how an RLS test passes while
proving nothing.

## Postgres errors arrive wrapped

The driver wraps them, so `rejects.toThrow(/policy/)` matches nothing. Walk the
cause chain, as `expectPgError` in `rls.integration.test.ts` does.

## An RLS test that is worth writing

Cover all five, not just the first:

1. An actor reads its own row
2. An actor cannot read another's
3. An insert claiming another owner is refused (`WITH CHECK`)
4. An update and a delete against another's row affect zero rows
5. With no actor context, nothing is visible

## The two-mode matrix

`byok` and `saas` differ in who pays and whether credits exist. Every scenario
runs in both because a change that works in only one mode is this architecture's
most likely failure. If a test genuinely applies to one mode, skip explicitly:

```ts
test.skip(process.env.GENNY_MODE !== 'saas', 'credits only exist in saas mode')
```

## Tests that spend money

Tag `@live`. They are excluded unless `E2E_LIVE=1`, so a contributor never spends
a cent. The nightly job runs them against `flux/schnell`.

## Do not write

A test asserting a constant. A snapshot of markup. A test for a one-line
pass-through. A mock of the database.
