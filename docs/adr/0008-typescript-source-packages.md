# 0008: TypeScript 7, `.ts` import paths, no package build

**Status:** accepted (2026-08-26)

## Context

Internal packages need to be consumable by Next, by Vitest, and by plain Node
scripts, without a watch-and-rebuild loop.

## Decision

TypeScript 7 with `allowImportingTsExtensions`. Packages export source through
`"exports": { "./*.ts": "./src/*.ts" }`. Every import path carries its extension.
No `index.ts` barrels. Next lists the packages in `transpilePackages`.

## Consequences

- No build step, no stale artefacts, no build order.
- One import rule everywhere, which also lets `node --experimental-strip-types`
  run a package script directly, as `db:migrate` does.
- Barrel-free imports keep the real dependency graph visible to tooling.
- Typecheck is fast enough that `pnpm check` stays a habit rather than a chore.
- TypeScript 7 is new. Verified on this repo before adopting: full typecheck of
  every package passes.

## Rejected

**Compiled packages with `tsup`.** A build step, a watch mode, and stale `dist`
bugs, for no gain in a repo with a single consumer.
**Extensionless imports with a wildcard export.** The exports pattern appended a
second `.ts` to any caller that wrote the extension, so one rule beats two.
