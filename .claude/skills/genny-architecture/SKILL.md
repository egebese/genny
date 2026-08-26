---
name: genny-architecture
description: Use when deciding where code belongs in the genny repo, adding a package, wiring a new dependency between packages, or when a file is getting long. Covers the package graph, the one-way dependency rule, what lives in packages versus features, and the enforced limits.
---

# Where code goes

## The question to ask first

**Can you describe this logic without mentioning Next?**

- Yes → `packages/<domain>/src/`. It becomes testable with vitest alone.
- No → `apps/web/src/features/<feature>/`. Server actions, composed UI, route glue.

Routes under `apps/web/src/app/` stay thin: parse the input, call a feature, render.

## The graph

```
env       ← nothing
models    ← nothing
ui        ← nothing (takes props, imports no domain package)
db        ← env
fal       ← env, models
auth      ← db, env
ratelimit ← db, env
assets    ← db, env
billing   ← db, env, models
jobs      ← db, env, fal, models, assets, billing
```

Adding an edge means editing `ALLOWED` in `tooling/src/check-deps.mjs`. That is
deliberate: a new dependency should show up in review as a line in a rules file.

## Hard rules, enforced by `pnpm check`

| Rule | Where it fails |
|---|---|
| SQL only in `packages/db` | any `drizzle-orm` import under `apps/` |
| fal calls only in `packages/fal` | any `@fal-ai/` import elsewhere |
| `packages/ui` imports no domain package | domain import under `packages/ui/` |
| No Dialog, Sheet, Drawer, Modal | those identifiers under `apps/` or `packages/ui/` |
| Config through `@genny/env` | `process.env.` in app code outside `/api/` |
| 200 lines per file | any source file, tests and migrations exempt |

## Adding a package

1. `packages/<name>/` with `package.json`, `tsconfig.json`, `src/`
2. `"exports": { "./*.ts": "./src/*.ts" }` and `"type": "module"`
3. Extend `@genny/tsconfig/node.json` or `react.json`
4. Add it to `ALLOWED` in `tooling/src/check-deps.mjs` with its permitted deps
5. Add it to `transpilePackages` in `apps/web/next.config.ts` if the app imports it
6. `pnpm install`, then `pnpm check`

No build step. No `index.ts`. Import the module you want, with its extension.

## When a file passes 200 lines

Split by responsibility, not by line count. The usual seams:

- A schema and the thing that uses it
- A pure calculation and the IO around it
- A component and its list item
- A route handler and the verification it performs first

If you cannot find a seam, the function is doing two things and the seam is
between them.

## Smells

| Smell | Fix |
|---|---|
| A feature imports `drizzle-orm` | add a function to `packages/db` and call it |
| A component takes a `db` handle | pass data, not connections |
| `if (mode === 'saas')` outside the three factories | put the branch in the factory, return an interface |
| A package with one function used once | inline it, delete the package |
| An interface with one implementation | delete the interface until there is a second |
