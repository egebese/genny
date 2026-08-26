# PRD: studio

The studio is the product. Everything else supports it.

## Shape

One route per modality: `/image`, `/video`, `/audio`. Same skeleton, same
components, different catalog slice. No tabs inside a page, because a URL that
cannot be shared is a feature that cannot be linked.

```
┌──────────────────────────────────────────┐
│ topbar: genny   Image Video Audio Assets │
├──────────────────────────────────────────┤
│                                          │
│   results (newest first, infinite)       │
│                                          │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ prompt, with @mentions               │ │
│ │ [model ▾] [1:1] [1K] [refs] [cost →] │ │
│ └──────────────────────────────────────┘ │  ← dock, always visible
└──────────────────────────────────────────┘
```

## The dock

The most important surface in the product. Always visible, never covered.

- Prompt textarea that grows to a cap, then scrolls.
- `@` opens an inline reference list. Not a modal, not a popover that steals
  focus: the caret stays in the textarea and you keep typing.
- Model selector: a non-modal popover with a category rail on the left and a
  thumbnail grid on the right, searchable.
- Per-model controls, rendered from the catalog entry. A model with no aspect
  ratio shows no aspect ratio control.
- Cost shown on the submit button before submitting. In byok mode this is fal's
  price; in saas mode it is credits.

## Results

A generation appears immediately as a placeholder card with live status, then
becomes the output. Failures show the reason and, in saas mode, confirm the
refund. Every output is one click from being reused as a reference.

## Requirements

| # | Requirement |
|---|---|
| S1 | Model selection persists per modality across reloads |
| S2 | A generation survives a page refresh: status resumes from the job row |
| S3 | Cost is shown before submit and matches what is charged, or the difference is refunded |
| S4 | A failed generation states why, in the user's words not fal's |
| S5 | Every output can become a reference in one action |
| S6 | Works at 375px wide with no horizontal scroll |
| S7 | Full keyboard path: prompt, model, submit, without a mouse |
| S8 | No modal, dialog, sheet or drawer anywhere |

## Out of scope for phase 1

Batch runs, prompt history search, presets, side-by-side comparison, canvas.
