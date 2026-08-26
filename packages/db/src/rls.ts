import { sql } from 'drizzle-orm'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { appRole } from './roles.ts'

/**
 * The actor id for the current transaction, set by withActor().
 *
 * The nullif is not cosmetic. Postgres returns an empty string, not NULL, for a
 * setting that was never set or whose transaction has ended, and `''::uuid`
 * raises instead of evaluating to NULL. Without nullif, a query with no actor
 * context fails with a cast error rather than quietly returning nothing, which
 * turns a denial into a 500 and hides the real problem.
 *
 * With it, a missing context is NULL, every comparison against it is NULL, and
 * the policy denies the row. Absent context fails closed.
 */
export const currentActor = sql`nullif(current_setting('app.actor_id', true), '')::uuid`

/**
 * Standard per-owner isolation: an actor sees and writes only its own rows.
 * `withCheck` matters as much as `using`: without it an actor could insert a row
 * owned by somebody else and then never be able to see what they did.
 */
export function ownerPolicy(table: string) {
  return pgPolicy(`${table}_owner_isolation`, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: sql`owner_id = ${currentActor}`,
    withCheck: sql`owner_id = ${currentActor}`,
  })
}

/** Read-only reference data: everyone reads, nobody writes through the app role. */
export function publicReadPolicy(table: string) {
  return pgPolicy(`${table}_public_read`, {
    as: 'permissive',
    for: 'select',
    to: appRole,
    using: sql`true`,
  })
}
