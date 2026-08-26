---
description: Generate and apply a database migration, verifying RLS landed in it
---

1. `pnpm db:generate`
2. Read the generated SQL. For any new tenant table, confirm it contains both
   `ENABLE ROW LEVEL SECURITY` and its `CREATE POLICY`. If either is missing, the
   schema is missing `.enableRLS()` or `ownerPolicy()`. Fix that, delete the
   generated file, and regenerate.
3. `pnpm db:migrate`
4. `pnpm test:integration`

If the table holds user data and has no isolation test yet, add one to
`packages/db/src/rls.integration.test.ts` covering read, forged insert, update,
delete and no-context access.
