# Contributing to genny

## Before you write code

1. Read [AGENTS.md](AGENTS.md). It is short and it is enforced by `pnpm check`.
2. Check [docs/phases/](docs/phases/) for the phase the work belongs to. Work
   that jumps ahead of the current phase usually gets asked to wait, not because
   it is bad but because the foundation it needs is not there yet.
3. For anything larger than a fix, open an issue first. A rejected PR is a worse
   outcome for you than a five-minute conversation.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm up && pnpm db:migrate && pnpm db:seed:models
pnpm dev
```

## Before you open a PR

```bash
pnpm fix                 # format and autofix
pnpm check               # biome + types + architecture rules
pnpm test                # unit
pnpm test:integration    # needs docker
pnpm e2e                 # needs a dev server, starts one if absent
pnpm changeset           # only for a release-worthy change; see below
```

CI runs all of it, in both modes. It will not tell you anything `pnpm check` did
not already tell you locally.

## Adding a model

This is the most common contribution and it should not touch UI code.

```bash
genmedia schema <endpoint-id> --json     # see the real input schema
genmedia pricing <endpoint-id> --json    # see the real price
```

Then add one file under `packages/models/catalog/<modality>/` and run
`pnpm db:seed:models`. `packages/models/src/catalog.test.ts` validates every
entry, so a malformed file fails before it reaches anyone's studio.
`skills/genny-model-catalog/` walks through it.

## What gets merged quickly

- A test that fails before your fix and passes after it.
- A model catalog entry with real prices from `genmedia`.
- A UI change that keeps working at 375px wide and opens no modal.
- Anything that deletes code without losing behaviour.

## What gets pushed back

- A new dependency where twenty lines would do.
- An abstraction with one implementation.
- A file over 200 lines.
- SQL outside `packages/db`, or a fal call outside `packages/fal`.
- A tenant table without an RLS policy and a test proving it isolates.

## Commit and PR shape

One PR, one subject. Conventional commit prefixes (`feat:`, `fix:`, `docs:`,
`test:`) are appreciated but not enforced.

Changesets are optional. Every package here is private and nothing is published
to npm, so a changeset only earns its keep when the change is worth a line in the
changelog. The release workflow is triggered by hand when there are some.

## Reporting a security issue

Do not open a public issue. See [SECURITY.md](SECURITY.md).
