---
description: Run every gate genny's CI runs, in the same order, and report what failed
---

Run these in order and stop at the first failure, reporting the actual output:

```bash
pnpm fix
pnpm check
pnpm test
pnpm test:integration
```

If `test:integration` cannot reach Docker, say so rather than reporting a pass.

Then summarise in three lines at most: what passed, what failed, what to do next.
Do not fix anything unless asked.
