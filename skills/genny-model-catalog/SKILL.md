---
name: genny-model-catalog
description: Use when adding, updating or removing a fal model in genny, when a model price changes, or when wiring how an @mention reaches a model's input fields. Covers the genmedia commands to get real data, the catalog file format, reference mapping, and seeding.
---

# Adding a model

The most common contribution. It should touch no code under `apps/`.

## 1. Get the real data

Never guess a schema or a price.

```bash
genmedia models "<search terms>" --limit 5 --json     # find the endpoint id
genmedia schema <endpoint-id> --json                  # real input fields
genmedia pricing <endpoint-id> --json                 # real price and unit
```

The pricing `unit` matters: `images`, `seconds`, `megapixels`, `requests` or
`minutes`. It decides how cost is estimated, so copy it exactly.

**fal's units are not a closed set.** `recraft/v3` bills in `compute seconds` and
`gpt-image-2/edit` in `units`, neither of which can be estimated before the run.
A model whose cost cannot be shown before the button is pressed does not belong
in the catalog yet: in byok mode the person cannot see what they are about to
spend, and in saas mode there is nothing to hold. Skip it and say why in the PR.

## 2. Write one file

`packages/models/catalog/<modality>/<slug>.json`:

```json
{
  "endpointId": "fal-ai/nano-banana-2/edit",
  "modality": "image",
  "group": "Editing",
  "displayName": "Nano Banana 2 Edit",
  "description": "Edit and combine reference images with a prompt.",
  "featured": true,
  "sortOrder": 20,
  "pricing": { "unit": "images", "unitPriceUsd": 0.08 },
  "creditMultiplier": 1.25,
  "inputs": [
    { "name": "prompt", "type": "string", "label": "Prompt", "required": true },
    { "name": "resolution", "type": "enum", "label": "Resolution",
      "default": "1K", "enum": ["0.5K", "1K", "2K", "4K"] }
  ],
  "references": [
    { "field": "image_urls", "array": true, "maxCount": 8, "token": "keep-label" }
  ],
  "capabilities": { "maxOutputs": 4 }
}
```

Rules the tests enforce: a required `prompt` input, a positive price, no
duplicate `endpointId`, and `sortOrder` unique enough to keep the picker
deterministic.

Only list inputs you want people to control. A hidden input is still sent:

```json
{ "name": "enable_safety_checker", "type": "boolean", "default": true, "hidden": true }
```

## 3. Reference mapping is the interesting part

This is what keeps `@mentions` out of UI code.

| Field | Meaning |
|---|---|
| `field` | which input receives the url, e.g. `image_url` or `image_urls` |
| `array` | true when the field takes a list |
| `maxCount` | the model's own limit; extra references are reported as dropped |
| `token` | `strip` removes `@label` from the prompt, `keep-label` leaves the bare name |
| `required` | true when the endpoint refuses to run without it, as editing models do |

Get `required` wrong in the permissive direction and fal answers 422 with a
reason nobody can see. With it set, the studio disables Generate and says what to
mention.

Use `keep-label` when the model reads names as subject cues (most editing models
do). Use `strip` when the name would just be noise.

## 4. Seed and check

```bash
pnpm db:seed:models
pnpm --filter @genny/models test
pnpm dev            # confirm it shows in the picker with the right price
```

## Price changes

`pnpm catalog:sync` refreshes files from fal and leaves a diff. CI runs it weekly
and opens a PR. Never apply a price change straight to the database: silent price
drift eats margin for weeks before anyone notices.

## Removing a model

Set `enabled = false` from the admin panel rather than deleting the file. Past
jobs reference the endpoint id, and a deleted row makes that history unreadable.
