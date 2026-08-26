---
description: Scaffold and build a feature following the repo's procedure
argument-hint: <feature-name>
---

Build `$1` following the `genny-feature` skill.

Before writing code, tell me in four lines:
- which phase in `docs/phases/` it belongs to
- which PRD in `docs/prd/` covers it, or that none does
- the files you will add
- what you are deliberately leaving out

Then work in this order: domain logic with tests, schema, server action, UI, one
e2e scenario. Finish with `pnpm check`, the test suites, and a changeset.
