# 0013. Deleting an account takes the ledger with it

Accepted.

## Context

`credit_ledger` is append-only on purpose. `genny_app` has no UPDATE and no
DELETE on it by grant (`packages/db/sql/grants.sql`), so a bug can add to
financial history but never quietly rewrite it. Correcting a mistake means
writing its inverse.

Account deletion goes the other way. Every table carrying an `owner_id`
references `users` with `ON DELETE cascade`, the ledger included, so deleting
one row removes everything that person ever did.

Those two facts do not merely coexist, they collide in a way that is easy to
miss: a foreign key cascade is performed as the owner of the referencing table.
It is subject to neither row-level security nor the REVOKE. So the one grant
that exists to make the ledger unrewritable does not apply to the single
statement that erases it, and nothing in the code says so.

## Decision

Deleting an account deletes the ledger with it.

Not a technical conclusion, a product one. "Delete my account" is a request to
be gone, and keeping a per-line record of what somebody spent, after they asked
to be removed, is the opposite of what they asked for.

Two things the cascade cannot do, and where they are handled:

- **Object storage.** A foreign key knows nothing about a bucket, so the files
  are removed first in `features/settings/server/account.ts`, paged, before the
  rows that name them are gone. Best effort: a bucket that is briefly
  unreachable must not become a reason somebody cannot close their account.
- **Sessions.** They are JWTs, so there is nothing on the server to revoke. The
  token in that browser would keep naming a row that no longer exists until it
  expired on its own, so the delete signs out.

## Consequences

- Revenue reporting cannot be reconstructed from our own ledger for a deleted
  account. Stripe keeps its own record of what was actually charged, which is
  the one an accountant would ask for anyway.
- The append-only grant stays exactly as it is. It is about bugs, not about
  deletion, and this is now written down rather than being a surprise.
- If a deployment ever needs the other behaviour, the change is to anonymise
  the `users` row rather than delete it, and to drop the cascade on
  `credit_ledger` in the same migration. Both would be visible; today's
  behaviour was not.
