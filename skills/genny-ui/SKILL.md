---
name: genny-ui
description: Use when building or changing any UI in genny, adding a component from a shadcn registry, styling anything, or working on mobile layout. Covers the token system, the no-modal and no-sidebar rules, the vendor/src split for registry components, and the mobile requirements.
---

# UI rules

## Two product decisions that shape everything

**No modals.** No dialog, sheet, drawer or modal, anywhere. `pnpm check` fails on
those identifiers. Use instead:

| Instead of | Use |
|---|---|
| A settings dialog | a route: `/settings` |
| An asset picker sheet | an inline panel in the dock |
| A model picker dropdown | a non-modal popover that keeps focus in the textarea |
| A confirm dialog | an inline confirm in place, or an undo after the fact |
| A mobile bottom sheet | the dock, which is already at the bottom |
| A lightbox for one result | a panel anchored to the node it belongs to |

The node panel on the canvas is the edge case worth knowing: it sets no
`aria-modal`, traps no focus and leaves the board live behind it, so it is an
inline panel that happens to float. If a surface makes the rest of the page
inert, it is a modal whatever it is called.

**No sidebar.** Topbar for navigation, dock for the prompt. On a phone the topbar
stays a topbar; nothing collapses into a hamburger. A panel anchored to something
you selected is not a sidebar; a persistent column down the edge is.

## Tokens

Everything visual comes from `packages/ui/tokens.css`. Never a raw hex, never an
arbitrary Tailwind value like `text-[#aabbcc]`.

```
surfaces   canvas, surface, surface-hover, line
text       ink, ink-muted, ink-faint
intent     accent, accent-ink, danger, warning
shape      radius-control, radius-panel
mobile     spacing-safe-top, spacing-safe-bottom, size-touch
```

A white-label buyer rebrands by editing that one file. Any colour that bypasses
it breaks that promise.

## Registry components

genny uses shadcn registries rather than hand-writing primitives:

```bash
pnpm dlx shadcn@latest add @blocks-so/ai-02
```

1. The raw component lands in `packages/ui/src/vendor/<namespace>/`
2. **Never edit a vendor file.** An upstream update overwrites it.
3. Write a styled wrapper in `packages/ui/src/` that maps props onto our tokens
4. The app imports the wrapper, never the vendor file

Starting points: `@blocks-so/ai-*` for prompt inputs, AI Elements for
`PromptInput` and `ModelSelector`.

## Mobile is a target

| Requirement | Why |
|---|---|
| Works at 375px, no horizontal scroll | e2e asserts it |
| Primary actions at least `--size-touch` (44px) | thumbs, not cursors |
| `--spacing-safe-*` on anything pinned to an edge | notch and home indicator |
| The prompt stays visible when the keyboard opens | it is the thing they came for |
| Nothing important above the fold on a phone | the fold is much higher there |

The e2e suite runs every scenario on Pixel 7 and iPhone 15, not a reduced subset.

## Accessibility floor

- Every interactive element reachable and operable by keyboard
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-accent`
- `aria-current` on the active nav item
- The mention list is a listbox with proper roles, announced on open
- Contrast checked against tokens, not eyeballed

## Component checklist

- [ ] Takes props, imports no domain package
- [ ] Colours and radii from tokens only
- [ ] Under 150 lines
- [ ] Named export, kebab-case filename
- [ ] Works at 375px
- [ ] Keyboard operable with a visible focus state
- [ ] No dialog, sheet or drawer
