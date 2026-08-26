---
description: Review the current changes against the repo's checklist
---

Review the diff against `main` using the `genny-review` skill.

Work in its order: money and tenancy first, then trust boundaries, then
architecture boundaries, then UI, then tests, then simplicity.

For each finding give the file and line, what breaks, and the fix. Separate
blocking from optional. If nothing is blocking, say so plainly rather than
inventing something.

Verify claims before making them: run `pnpm check` rather than assuming it
passes.
