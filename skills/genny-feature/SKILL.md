---
name: genny-feature
description: Use when starting a new feature in genny, from branch to merged PR. The end-to-end procedure: which phase it belongs to, the file skeleton, where the seams go, tests, changeset and PR shape.
---

# Building a feature

## Before any code

1. Which phase? Check `docs/phases/`. Work ahead of the current phase usually
   waits for the foundation it needs.
2. Which PRD covers it? `docs/prd/`. If none, the feature needs a paragraph there
   first: a feature nobody wrote down is a feature nobody agreed to.
3. Does it need an ADR? Only if it makes a decision someone will later ask "why"
   about.

```bash
git checkout -b feat/<short-name>
```

## The skeleton

Split at the Next boundary. Domain logic first, glue second.

```
packages/<domain>/src/
  <thing>.ts             pure logic, no Next, no request
  <thing>.test.ts        written alongside, not after

apps/web/src/features/<feature>/
  schema.ts              zod schemas for every input
  server/<action>.ts     'use server', parses first, calls domain
  ui/<component>.tsx     presentation, props only

apps/web/src/app/(studio)/<route>/page.tsx
  thin: read params, call the feature, render
```

## Order of work

1. **Domain first, with tests.** It runs in milliseconds and it is where the
   thinking is.
2. **Schema next.** The shape of the input is the contract.
3. **Server action.** Parse, limit, authorise, call domain, return.
4. **UI last.** By now the data shape is settled, so the component is not rewritten.
5. **One e2e scenario** for the flow a person performs.

## Where the seams go

| Seam | Reason |
|---|---|
| Between calculation and IO | the calculation gets a fast unit test |
| Between the fal call and the decision to make it | the decision is testable without a network |
| Between a component and its list item | the item gets its own states |
| Between verification and handling in a webhook | verification is testable with fixtures |

## Definition of done

```bash
pnpm fix
pnpm check
pnpm test && pnpm test:integration
GENNY_MODE=byok pnpm e2e && GENNY_MODE=saas pnpm e2e
pnpm changeset
```

- [ ] Works at 375px and on a keyboard
- [ ] No modal, no sidebar
- [ ] The security checklist in `genny-security` passed
- [ ] The PR body says what it does and what it deliberately leaves out

## Scope discipline

If you find unrelated dead code, mention it in the PR body. Do not delete it
here. One PR, one subject: a review that has to hold two subjects holds neither
well.
