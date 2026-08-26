---
description: Add a fal model to the catalog using real data from genmedia
argument-hint: <fal-endpoint-id>
---

Add `$1` to the model catalog. Use the `genny-model-catalog` skill.

1. Fetch the real schema and price. Never guess either:
   ```bash
   genmedia schema $1 --json
   genmedia pricing $1 --json
   ```
2. Write one file under `packages/models/catalog/<modality>/`.
3. Expose only inputs a person should control. Mark the rest `hidden`.
4. Set `references` from the endpoint's actual reference fields, with the model's
   own `maxCount`.
5. Verify:
   ```bash
   pnpm --filter @genny/models test
   pnpm db:seed:models
   ```

Touch nothing under `apps/`. If that seems necessary, the reference mapping is
wrong; say so instead of working around it.
