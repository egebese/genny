# PRD: assets and mentions

The feature that separates a tool from a demo.

## The idea

Everything the user has, uploaded or generated, has a handle. Typing `@` in a
prompt offers those handles. A reference used once is reusable forever.

```
@ayse standing in @room1, golden hour
```

`@ayse` is a character: a named bundle of reference images. `@room1` is a single
asset. The model receives urls in whichever field it expects; the user never
learns that one endpoint wants `image_url` and another wants `image_urls`.

## Storage

fal keeps generated media for about a week. That is fine for a playground and
useless for a library, so every generated output is ingested into our own bucket
and the asset row points at that copy. The fal url is never the source of truth.

## Data

| Concept | Row | Note |
|---|---|---|
| Asset | `assets` | `label` is the handle, unique per owner |
| Character | `characters` + `character_assets` | ordered bundle of reference images |
| Prompt | stored on the job as `{ text, references[] }` | text and references separate, never re-parsed |

## Mention behaviour

| # | Requirement |
|---|---|
| A1 | `@` after whitespace opens the list; typing filters it; Escape closes without losing the text |
| A2 | The caret never leaves the textarea while the list is open |
| A3 | Arrow keys and Enter select; the list is reachable and announced to a screen reader |
| A4 | A reference the current model cannot accept is reported, never silently dropped |
| A5 | Switching to a model with fewer reference slots warns before it truncates |
| A6 | A label is unique per owner, so a handle is never ambiguous |
| A7 | Deleting an asset that a past job referenced keeps the job readable |

## Upload

Presigned PUT straight to the bucket. Content-type allowlist, size cap, magic-byte
check on the server, per-owner quota. A file the server has not verified never
becomes an asset row.

## Out of scope for phase 1

Folders, tags, smart collections, sharing, bulk edit. The flat list plus search
carries a long way, and folders are cheap to add later.
