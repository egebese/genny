# PRD: model catalog

## The split

**Files are the truth about what a model is.** One JSON file per model in
`packages/models/catalog/<modality>/`: endpoint, price, inputs, and where an
`@mention` lands in its payload.

**The table is the truth about how we sell it.** Enabled, ordered, featured,
credit multiplier. An operator changes those from the admin panel without a
release.

`catalog_hash` on the row records which file version was seeded, so drift is
visible instead of mysterious.

## Adding a model

```bash
genmedia schema <endpoint> --json      # real inputs
genmedia pricing <endpoint> --json     # real price
```

Then one file. `catalog.test.ts` validates every entry: a required prompt input,
a positive price, no duplicate endpoints, deterministic ordering. A malformed
entry fails in CI, not in someone's studio.

Adding a model touches no UI code. That is the whole point of the reference
mapping living in the catalog.

## Sync

`pnpm catalog:sync` refreshes files from fal via `genmedia`. Weekly in CI, and it
opens a PR rather than writing to the database.

A price changing silently is the most expensive failure this system has: it eats
margin quietly for weeks. So the sync produces a diff a human approves.

## Requirements

| # | Requirement |
|---|---|
| M1 | Every catalog entry validates against the zod schema, in CI |
| M2 | Adding a model requires no change under `apps/` |
| M3 | A disabled model disappears from the picker and refuses new jobs, while past jobs stay readable |
| M4 | The picker groups by category, searches by name, and shows price per model |
| M5 | A price change is surfaced as a reviewable diff, never applied silently |
| M6 | The admin panel shows the live input schema of each model |

## Out of scope

Automatic model discovery, user-submitted models, per-user catalogs, A/B routing.
