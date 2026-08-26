---
name: genny-release
description: Use when cutting a release of genny, applying migrations to a deployed instance, or rolling one back. Covers changesets, migration ordering, the grants step, deploy sequence and what to do when a migration is already out.
---

# Releasing

## Versioning

Changesets, and they are optional. Every package here is private, so nothing is
published to npm and a changeset's only job is a changelog line:

```bash
pnpm changeset          # pick packages, pick bump, write one human sentence
```

Write the sentence for someone deciding whether to upgrade, not for someone
reading the diff. The release workflow is triggered by hand from the Actions tab
once there are changesets worth cutting.

## Deploy order

Migrations before code, always. New code against an old schema fails immediately
and loudly; old code against a new schema usually keeps working.

```bash
pnpm db:migrate      # migrations, then grants re-applied
# then deploy the app
```

`db:migrate` re-applies `packages/db/sql/grants.sql` every time on purpose: a
table added by a migration is invisible to `genny_app` until it is granted, and
that failure surfaces hours later as a confusing permission error.

## Migrations have to be backwards compatible

The app runs old and new code at once during a rollout.

| Change | How |
|---|---|
| Add a column | nullable, or with a default. Never `NOT NULL` without one. |
| Remove a column | stop writing it, ship, then drop in the next release |
| Rename | add, backfill, dual-write, ship, then drop |
| Add a tenant table | policy and RLS in the same migration, never a follow-up |

A migration that has been applied anywhere is immutable. Fix it forward.

## Before tagging

```bash
pnpm check
pnpm test && pnpm test:integration
GENNY_MODE=byok pnpm e2e && GENNY_MODE=saas pnpm e2e
pnpm catalog:sync --check        # no unreviewed price drift
E2E_LIVE=1 pnpm e2e              # one real generation, cents
```

## Rolling back

Roll back the app first, then decide about the schema. Because migrations are
backwards compatible, the old app usually runs fine against the new schema, which
means you almost never need a down migration under pressure.

If a release corrupted data, the ledger is append-only: write correcting rows
with an explanatory note. Do not edit history.

## After releasing

- [ ] Health endpoint green on the deployed instance
- [ ] One real generation completed
- [ ] Credits charged and, on a forced failure, refunded
- [ ] Changelog published
