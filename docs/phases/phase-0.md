# Phase 0: foundation

**Milestone:** M0 · **Status:** complete

The job: a fresh clone reaches a running studio in five commands, and the
security boundary that everything else leans on is proven rather than asserted.

## Scope

- pnpm workspace, Turborepo, Biome, shared tsconfig
- Docker stack: Postgres 17 and MinIO on non-colliding ports
- `@genny/env`: every variable validated with zod, blank optionals treated as absent
- `@genny/db`: 12 tables, RLS policies, two roles, migrations, grants
- `@genny/models`: catalog schema, three real entries, credit maths, reference mapping
- `@genny/fal`: BYOK key sealing, credential resolution per mode
- `@genny/ratelimit`: Postgres limiter, atomic under concurrency
- `@genny/auth`: signed anonymous actors
- `@genny/ui`: design tokens, Button, Topbar, Dock
- `apps/web`: landing, studio shell, health endpoint, CSP and security headers
- `tooling/src/check-deps.mjs`: architecture rules enforced in CI
- Playwright e2e in both modes, desktop and phone
- Docs: 8 PRDs, 8 ADRs, architecture, security, testing, self-hosting
- 8 skills in `skills/`, linked from `.claude/skills` and `.agents/skills`, plus 6 commands
- GitHub: milestones, labels, templates, CODEOWNERS, workflows

## Exit criteria

| # | Criterion | How to check |
|---|---|---|
| 0.1 | Five commands from clone to running studio | follow the README on a clean checkout |
| 0.2 | Health endpoint green on env, catalog and database | `curl localhost:3000/api/health` |
| 0.3 | RLS proven, not assumed | `pnpm test:integration` |
| 0.4 | Limiter correct under parallel load | 25 parallel requests, limit 5, exactly 5 admitted |
| 0.5 | Architecture rules actually fail a violation | inject one, watch `pnpm check` fail |
| 0.6 | No horizontal scroll at 375px | `pnpm e2e` |
| 0.7 | CSP, nosniff, HSTS, no `x-powered-by` | `pnpm e2e` |
| 0.8 | Full typecheck clean | `pnpm check` |
| 0.9 | Production build works | `pnpm build` |

## Deliberately not here

Any generation. Phase 0 proves the foundation; phase 1 uses it.

## What phase 0 taught us

Three real defects, all found by tests rather than review:

1. RLS with no actor context raised a cast error instead of denying, because
   Postgres returns `''` and not NULL for an unset setting. Fixed with `nullif`.
2. `grants.sql` only ran its first statement: the driver's prepared-statement
   path silently drops the rest of a multi-command string, so every `REVOKE` was
   skipped and the ledger was writable.
3. A blank optional in `.env` is an empty string, not an absent value, so the app
   refused to boot on a perfectly normal config file.

Each now has a test that fails if it comes back.
