# Phase 1: image studio, end to end

**Milestone:** M1 · **Mode:** byok

The job: someone pastes their fal key and gets an image they can reuse. This is
the phase that makes the project worth linking to.

## Scope

- Key entry: paste a fal key, sealed into a cookie, validated against fal once
- Model picker: category rail, thumbnail grid, search, non-modal
- Prompt dock: growing textarea, per-model controls from the catalog, cost preview
- `@mention`: inline reference list, caret stays in the textarea
- Assets: presigned upload, magic-byte verification, grid, labels
- Characters: named bundles of reference images
- Job pipeline: submit, SSE status stream, fal queue polling
- Output ingestion into our own bucket, with thumbnails
- Results feed, download, reuse as reference
- History
- Minimal landing page and a public demo deployment

## Exit criteria

| # | Criterion |
|---|---|
| 1.1 | Paste key → pick model → prompt → generate → see result → download, in both viewports |
| 1.2 | Upload an asset, `@mention` it, and the reference reaches the right model field |
| 1.3 | A reference the model cannot take is reported, never silently dropped |
| 1.4 | A generation survives a page refresh: status resumes from the job row |
| 1.5 | The key is absent from the database, the logs and every response body |
| 1.6 | Outputs live in our bucket, not on a fal url that expires |
| 1.7 | Rate limits refuse an abusive loop with a useful message |
| 1.8 | `pnpm e2e` green in both modes, both viewports |
| 1.9 | A `@live` smoke test generates against real fal for under a cent |
| 1.10 | The demo is deployed and linked from the README |

## Out of scope

Credits, accounts, Stripe, video, audio, admin, blog.
