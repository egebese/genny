# 0004: catalog in files, operations in the database

**Status:** accepted (2026-08-26)

## Context

fal has 1300+ models with changing prices and schemas. We expose a curated subset
and resell it at a margin.

## Decision

A model is defined by a JSON file in `packages/models/catalog/`, validated by zod
in CI. The `models` table carries the operational layer: enabled, order,
featured, credit multiplier. `catalog_hash` records which file version was seeded.

`pnpm catalog:sync` refreshes files from fal through the `genmedia` CLI and opens
a PR.

## Consequences

- Adding a model is one file and one review. It touches no code under `apps/`.
- An operator re-prices from the admin panel without a deploy.
- A fal price change arrives as a reviewable diff. Silent price drift is the most
  expensive failure this system has, so a human approves it.
- The file and the row can disagree. `catalog_hash` makes that visible rather
  than mysterious.

## Rejected

**Database only.** Model definitions would live outside code review.
**Files only.** Re-pricing would need a deploy.
**Live fal API on every render.** A slow, rate-limited dependency in the hot path.
