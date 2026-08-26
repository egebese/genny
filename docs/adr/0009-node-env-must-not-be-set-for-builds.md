# 0009: NODE_ENV never belongs in an env file

**Status:** accepted (2026-08-26)

## The symptom

`next build` failed:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

The stack landed inside Next's own bundled code, the same failure is reported
upstream by several people, and it looked exactly like a framework bug.

## The actual cause

`.env` carried `NODE_ENV=development`, and every command in this project sources
`.env` before running.

With NODE_ENV=development set, `next build` emits a production bundle while
resolving **React's development build**. React 19 ships a `react-server`
conditional export whose build omits the client hooks, so `React.default` is null
in the server layer and the first `useContext` inside `next/link` throws. Nothing
in the message mentions NODE_ENV or our code.

Proof, three runs at the same commit:

| Environment | Result |
|---|---|
| `.env` sourced, `NODE_ENV=development` | fails |
| `.env` sourced, `NODE_ENV` unset | **builds** |
| `NODE_ENV=development` alone, nothing else | fails |

## Decision

1. NODE_ENV is not in `.env` or `.env.example`. The tool decides it: `next dev`
   means development, `next build` means production.
2. `apps/web/next.config.ts` refuses to build when NODE_ENV=development, with a
   message that names the cause. The failure is otherwise unreadable.

## How the diagnosis went wrong, and what to take from it

This took far longer than it should have, for one reason worth recording: **the
measurement was broken before the hypothesis was.**

The probe was `next build | grep -c "Error occurred prerendering"`. When a change
made the build fail *earlier*, at TypeScript or at module resolution, that string
never printed and the probe reported zero. Every such run looked like a fix.

That produced a series of confident, wrong conclusions:

| Claimed | Actually |
|---|---|
| "Fails on every 16.3.x, so it is a version regression" | Reproduced on every version because NODE_ENV was set every time |
| "16.2.12 builds" | It aborted earlier on a TypeScript 7 incompatibility |
| "zod triggers it" | Measured while an import was broken; zod is irrelevant |
| "Needs 8 dependencies" | Same broken measurement |

The lesson, now a rule in `genny-testing`: **measure a build by its exit code.**
Grepping for a specific error only tells you whether that error was reached.

The `@genny/models/request.ts` and `@genny/fal/key-input.ts` split came out of a
wrong hypothesis, and it is kept: validation schemas belong with the domain they
describe, and the app no longer imports zod at all.

## Consequences

- `pnpm build` works, so the app can be deployed and the demo can ship.
- `pnpm build` is a blocking CI job.
- Next stays on 16.3.3, the security-patched release. There was never a reason to
  pin away from it.
