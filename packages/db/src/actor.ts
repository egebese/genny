import { sql } from 'drizzle-orm'
import type { Database } from './client.ts'

/**
 * Runs `fn` inside a transaction whose actor context is set, which is the only
 * way RLS lets the application role see anything at all.
 *
 * The third argument to set_config is `is_local = true`, so the setting is
 * scoped to this transaction and cannot leak to the next borrower of the pooled
 * connection. That leak is exactly how a multi-tenant app serves one customer's
 * data to another.
 */
export async function withActor<T>(
  db: Database,
  actorId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.actor_id', ${actorId}, true)`)
    return fn(tx as unknown as Database)
  })
}

/**
 * Escape hatch for work that has no actor: migrations, the reconcile sweep, the
 * Stripe webhook. Requires a privileged connection; calling it with the app
 * connection returns nothing, loudly and safely, because no policy matches.
 */
export async function withoutActor<T>(db: Database, fn: (tx: Database) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx as unknown as Database))
}
