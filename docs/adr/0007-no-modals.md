# 0007: no modals, dialogs, sheets or drawers

**Status:** accepted (2026-08-26)

## Context

A generation studio has many secondary surfaces: model picking, asset browsing,
settings, references. The default reach is a dialog or a drawer.

## Decision

None of them. Every surface is a route, an inline panel, or a non-modal popover.
Enforced by `tooling/src/check-deps.mjs`, which fails the build on a `Dialog`,
`Sheet`, `Drawer` or `Modal` identifier under `apps/` or `packages/ui/`.

## Consequences

- State lives in the URL, so any view is shareable and the back button is honest.
- Mobile stops being a special case: a bottom sheet that covers the prompt is the
  worst thing a phone layout can do, and it is now unbuildable.
- Focus traps, scroll locking and `aria-modal` stop being an accessibility
  surface we have to get right repeatedly.
- Some flows are more work. The model picker becomes a positioned popover that
  keeps focus in the textarea, which took real effort.

## Rejected

**Dialogs for secondary flows.** Cheaper to build, and it is how the studio ends
up with three stacked layers that trap a phone user.
