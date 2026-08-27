# How code is written here

This file is about *how* to write code in this repo, not about what the product
is. For that, read `README.md` and `docs/prd/`.

`CLAUDE.md` is a symlink to this file. One source, two names.

Skills work the same way: they live in `skills/`, and `.claude/skills` and
`.agents/skills` are symlinks to it. One set of instructions, whichever agent
reads them. Add a skill to `skills/`, never to a link.

## Non-negotiables

These are enforced by `pnpm check` (`tooling/src/check-deps.mjs`), not by review
alone. If you disagree with one, change the rule and its check in the same PR.

| Rule | Why |
|---|---|
| SQL lives only in `packages/db` | The app asks a repository function for data. A query in a route handler cannot be tested, reused, or audited for RLS. |
| fal calls live only in `packages/fal` | Credentials, retries and the byok/saas split have exactly one home. |
| `packages/ui` imports no domain package | The design system takes props. A UI package that knows about jobs cannot be previewed or reused. |
| No modals, dialogs, sheets or drawers | A route, an inline panel or a non-modal popover instead. Product decision, applies everywhere. |
| No sidebar | Topbar plus a bottom dock. The dock is where the prompt lives on every screen size. A panel anchored to a selected node is not a sidebar; a persistent one down the edge is. |
| Config comes from `@genny/env` | It is validated with zod at boot. `process.env.FOO` in app code skips that. |
| 200 lines per file, hard | Past that a file is doing two things. Tests and migrations are exempt. |
| `GENNY_MODE` is read in three factories only | `packages/billing`, `packages/fal`, `packages/auth`. Everywhere else works through the interface, so the e2e matrix covers both modes without every file branching. |

## Layout

```
apps/web/src/app/        Next routes. Thin: parse, call, render.
apps/web/src/features/   Next-specific glue: server actions, composed UI.
packages/*               Framework-free domain. Testable with vitest alone.
```

Dependency direction is one way and listed in `ALLOWED` in
`tooling/src/check-deps.mjs`. `apps` depends on `features` depends on `packages`.
Nothing points back.

Put logic in `packages/` when it can be described without mentioning Next. Put it
in `features/` when it cannot.

## Package imports

Every import path ends in `.ts` or `.tsx`, inside a package and across packages
alike:

```ts
import { withActor } from '@genny/db/actor.ts'
import { Button } from '@genny/ui/button.tsx'
```

Internal packages ship TypeScript source, no build step. There are no barrel
files: import the module you want. `index.ts` re-export chains hide the
dependency graph from both humans and tooling.

## Validation

Every trust boundary parses with zod before anything else happens: route
handlers, server actions, webhooks, env, and the model payload. The model payload
is validated against a schema generated from that model's own catalog entry
(`buildInputSchema`), not against a shared union that would have to accept
everything.

```ts
'use server'
export async function createGeneration(raw: unknown) {
  const input = createGenerationSchema.parse(raw)   // first line, always
  ...
}
```

## Multi-tenancy

Every query that touches tenant data goes through `withActor(db, actorId, fn)`.
It sets the actor for that transaction only; RLS policies compare against it.
Without it a query returns nothing, which is the correct failure direction.

The application connects as `genny_app`, which owns no tables and has no
BYPASSRLS. Migrations connect as `genny_migrator`. If you add a tenant table:
add `owner_id`, add `ownerPolicy('table_name')`, call `.enableRLS()`, and add a
test to `rls.integration.test.ts` proving one actor cannot see another's row.

## Secrets

The BYOK fal key is someone else's money. It is never written to the database,
never logged, never returned in a response. It exists only sealed inside a
cookie (`sealKey`/`unsealKey`). Anything key-shaped gets added to
`packages/env/src/redact.ts`.

## Money

Credits are an append-only ledger plus a cached balance. Never `UPDATE` a ledger
row; write its inverse. Every write carries an `idempotencyKey`, so a replayed
webhook or a retried job is a no-op rather than a double charge. `genny_app` has
no UPDATE or DELETE on `credit_ledger`, by grant.

## Tests

Non-trivial logic leaves one runnable check behind: a branch, a loop, a parser, a
money path, a security path. Trivial one-liners do not need a test.

| What | Where | Tool |
|---|---|---|
| Domain logic | `packages/*/src/*.test.ts` | vitest |
| Anything touching Postgres | `packages/*/src/*.integration.test.ts` | vitest + testcontainers |
| User-visible flows | `e2e/tests/*.spec.ts` | Playwright, both modes |

Integration tests use a real Postgres. Mocking the database would prove the mock
works. Tests that spend real fal credits are tagged `@live` and do not run by
default.

## Style

- `pnpm fix` before pushing. Biome is the only formatter and linter.
- No `any`, no `as` outside tests, no non-null `!`.
- File names kebab-case; components PascalCase; no default exports except where
  Next requires them.
- Comments explain *why*. Do not narrate what the next line does.
- Match the surrounding code. If you would write it differently, that is a
  separate PR.

## Commands

```bash
pnpm up                  # docker: postgres + minio
pnpm db:migrate          # apply migrations, then re-apply grants
pnpm dev                 # next dev on :3000
pnpm check               # biome + tsc + architecture rules
pnpm test                # unit
pnpm test:integration    # testcontainers
pnpm e2e                 # playwright (GENNY_MODE picks the mode)
pnpm catalog:sync        # refresh model catalog from fal via genmedia
```

## One PR, one subject

If you noticed unrelated dead code, say so in the PR body; do not delete it here.

Changesets are optional: nothing here is published to npm, so add one only when
the change deserves a changelog line.
