# 0009: `next build` is broken upstream, and what we know about it

**Status:** accepted (2026-08-26), open problem. Revisit on every Next release.

## The problem

`next build` fails on this repo:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
    at (.next/server/chunks/ssr/…_next_dist_….js)
```

The stack lands inside Next's own bundled code, not ours: React's dispatcher is
null while Next renders its internal error page. `next dev` is unaffected, the
whole test suite passes, and every route works in the browser.

## What we ruled out

| Hypothesis | Result |
|---|---|
| Next version | fails on 16.3.0, 16.3.2, 16.3.3 and 16.4.0-canary.8 |
| Next 16.2 | appeared to pass, but only because it aborted earlier on a TypeScript 7 incompatibility. With `experimental.useTypeScriptCli` it fails the same way. |
| Bundler | fails with Turbopack and with `--webpack` |
| React version | 19.2.0 and 19.2.8 behave identically |
| Duplicate React | one copy in the store; `require.resolve` agrees from app and from `packages/ui` |
| Our error pages | fails with no custom `global-error.tsx` and no `not-found.tsx`; the failure just moves to whichever page prerenders first |
| Our components | fails with a two-line layout and a one-line page |
| Our config | fails with an empty `next.config.ts` |
| `transpilePackages` | fails with and without |
| `"type": "module"` | removing it from the app changed which page failed, not whether it failed |
| A standalone Next app | same Next, same React, npm or pnpm: **builds fine** |
| This app with minimal `app/` and one workspace dependency | **builds fine** |

So it needs the combination of this repo's dependency graph and more than a
trivial route tree. That matches the upstream reports
([#95741](https://github.com/vercel/next.js/issues/95741),
[#86178](https://github.com/vercel/next.js/issues/86178),
[#84994](https://github.com/vercel/next.js/issues/84994)), all closed for lack of
a minimal reproduction rather than because a fix landed. This repo is a smaller
reproduction than any of them: five routes and no Sentry, next-themes or tRPC.

## Decision

1. Stay on `next@16.3.3`, the security-patched release. Since every version
   fails, take the safest one rather than trading a security fix for nothing.
2. Keep `pnpm build` in CI as a non-blocking job, so the day it goes green we
   notice, and contributors are not blocked by a failure they did not cause.
3. Track it as the first issue of M1. Phase 1 ships a public demo, and a demo
   needs a build.
4. File the reproduction upstream.

## Consequences

- The app cannot be deployed to production yet. `next dev` works, so development
  and the whole test suite are unaffected.
- Anyone bumping Next should run `pnpm build` first; that is the only signal.

## Related

TypeScript 7 (ADR 0008) is fine on 16.3, which accepts it without
`experimental.useTypeScriptCli`. On 16.2 it is not. That is a second reason not
to fall back to the 16.2 line.
