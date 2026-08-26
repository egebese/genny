# 0001: pnpm workspaces with Turborepo

**Status:** accepted (2026-08-26)

## Context

Landing, app and backend ship together, and the domain logic has to be usable by
both a Next route and a CLI script.

## Decision

pnpm workspaces for linking, Turborepo for task orchestration and caching.
Internal packages ship TypeScript source with no build step; the app transpiles
them.

## Consequences

- One compile per app. No stale `dist` to debug, no build order to maintain.
- `turbo run --filter=...[origin/main]` keeps CI proportional to the diff.
- Every import path ends in `.ts`, inside and across packages, which is one rule
  instead of two.
- A package cannot be published to npm as-is. Acceptable: nothing here is meant
  to be consumed outside this repo.

## Rejected

**Nx.** More capable, more configuration, and its generators push a structure we
would fight.
**Single Next app with folders.** Nothing would stop a route from importing a
query. The package boundary is the enforcement.
