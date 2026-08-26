## What this does

<!-- One or two sentences. If it needs more, it is probably two PRs. -->

## What it deliberately leaves out

<!-- Scope you chose not to take on, so a reviewer does not look for it. -->

Closes #

## Checks

- [ ] `pnpm check` passes (lint, types, architecture rules)
- [ ] `pnpm test` and, if the change touches Postgres, `pnpm test:integration`
- [ ] `pnpm e2e` in both modes, if the change is user-visible
- [ ] A changeset, if the change deserves a changelog line

## If this touches user data

- [ ] New table has `owner_id`, `ownerPolicy()`, `.enableRLS()`
- [ ] An isolation test proves one actor cannot reach another's row

## If this touches money

- [ ] Every ledger write has an idempotency key
- [ ] The failure path refunds

## If this touches UI

- [ ] No dialog, sheet, drawer or modal
- [ ] Works at 375px, no horizontal scroll
- [ ] Keyboard operable with a visible focus state
- [ ] Colours from tokens, no raw hex
