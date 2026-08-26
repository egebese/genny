---
description: Refresh the model catalog from fal and report what changed
---

```bash
pnpm catalog:sync
```

Then report, as a table: which models changed, what the old and new values were,
and specifically any **price** change with its effect on margin at the current
`CREDIT_PER_USD`.

Do not commit a price change without flagging it explicitly. A silent price drift
is the most expensive failure this system has.
