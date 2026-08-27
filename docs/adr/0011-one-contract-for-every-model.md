# 0011: one contract every model satisfies

**Status:** accepted (2026-08-27)

## Context

Adding a model was writing a JSON file and hoping. Four separate things had to
be right and nothing checked any of them together:

- **The price.** Hand-entered from fal's prose. `nano-banana-2` charges 1.5x for
  2K and 2x for 4K, and `ideogram/v3` charges 2x for BALANCED and 3x for
  QUALITY, which is its own default. Neither was encoded, so both were held at
  a fraction of their cost. The estimate *is* the hold, and `settle` captures
  `held × produced ÷ expected` and never more, so the difference was never
  recoverable: a permanent discount nobody chose.
- **The input schema.** The dock renders `resolution` as a slider, `aspect_ratio`
  as rectangles and `num_images` as a bounded stepper. An entry whose enum was
  empty, whose default was not one of its options, or whose count had no
  ceiling produced a control that looked fine and was not.
- **The references.** `nano-banana-2` declares no slot. Mentioning an asset ran
  the generation anyway, dropped the reference, returned a picture that ignored
  it and reported the drop after the money.
- **The picker.** No provider mark meant a hole in the grid, found by looking.
  Worse, it listed endpoints rather than models. fal splits one model across
  URLs by what you hand it, so Nano Banana 2 appeared twice and one of the two
  could truthfully say "Nano Banana 2 takes no image" while standing on an image
  the model plainly takes.

## Decision

`packages/models/src/contract.ts` holds the rules as data, and
`contract.test.ts` runs them over the real catalog. Eight rules today. Each one
exists because a model already reached the product broken in that exact way, and
deleting one means arguing the case away in the same change: the test asserts the
list of rule names, so a rule cannot quietly disappear.

Price gets two mechanisms rather than one:

- `pricing.unitPriceUsd` and `unit` are checked against the genmedia CLI by
  `catalog:sync`, in one batched request, with the unit vocabulary normalised so
  `$0.10 per 1000 characters` and `$0.0001 per character` are recognised as
  agreement rather than reported as drift.
- `pricing.scale` carries the conditions the flat number cannot: one field, and
  the values billed at a different rate. Applied to the units, not to the price,
  so the hold, the capture and the number on the button are one calculation and
  cannot drift apart.

A catalog entry names its `family`, and the picker shows families. Which
endpoint a generation goes to is worked out from what is attached: nothing
reaches the text task, an image reaches the edit task, and of the endpoints that
fit, the one that uses the most of what was given wins. The URL is an
implementation detail of fal's routing and nobody should have to know which one
they are on.

The reference rule is enforced on both sides of the wire from one function.
`unusableKinds` takes slots rather than a model, so the server's
`ModelDefinition` and the browser's `PickableModel` answer it identically: the
dock disables generate and offers the nearest model that can take the input, and
the server refuses before holding anything. Neither is trusted alone.

## Consequences

- A new model is `pnpm cards`, `catalog:sync --check` and `pnpm test`. All three
  are in `pnpm check` except the sync, which needs a network.
- Prices are still never written automatically. genmedia answers $0.005/s for
  PixVerse against a published $0.03 to $0.12, a base unit no request is ever
  charged, so a sync that wrote what it was told would have undercharged by 10x.
  It reports; a human writes the number and says why in `pricing.note`.
- The conditions live in fal's prose and the prose is not parsed for them. The
  sync flags an entry whose published text talks about a different rate and whose
  catalog entry is silent about one. It asks for a decision, not for a factor:
  an endpoint may honestly charge one rate at every size.

## Rejected

**Deriving the family name from its members.** It would mean picking whichever
member sorts first, and `fal-ai/nano-banana-2` sorting before its own `/edit` is
luck rather than design. Every member repeats the name and the contract checks
they agree.

**Deriving the catalog from the schema at boot.** fal's OpenAPI has the fields
and the types and none of the rest: which control is a shape, what a slot means,
what a 4K output costs. The catalog is the file where we say what fal does not.

**Auto-writing prices from the CLI.** Tried in the report first. PixVerse alone
makes it a 10x undercharge, and an undercharge is invisible until someone
reconciles a bill.
