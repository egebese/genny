import { createClient, type Database } from './client.ts'

type Pool = ReturnType<typeof createClient>
// Explicit `| undefined` rather than an optional key: exactOptionalPropertyTypes
// distinguishes "absent" from "present and undefined", and closePools assigns
// undefined deliberately.
type Pools = { app: Pool | undefined; owner: Pool | undefined }

const pools: Pools = { app: undefined, owner: undefined }

/**
 * The connection the application uses. Runs as genny_app, so RLS applies and
 * every query has to go through withActor to see anything.
 *
 * Lazy and cached: a pool per request would exhaust Postgres under any real
 * traffic, and creating one at import time breaks tooling that imports a schema
 * without a database.
 */
export function appDb(url: string): Database {
  pools.app ??= createClient({ url, max: 10 })
  return pools.app.db
}

/**
 * Elevated connection for the few things that cannot have an actor context:
 * creating an actor in the first place, the Auth.js adapter looking up an account
 * before anyone is signed in, and the reconcile sweep.
 *
 * Never reachable from a route handler that takes user input. If a feature wants
 * this, it almost always wants withActor instead.
 */
export function ownerDb(url: string): Database {
  pools.owner ??= createClient({ url, max: 4 })
  return pools.owner.db
}

/** Tests and scripts close what they opened; long-running servers never call this. */
export async function closePools(): Promise<void> {
  await Promise.all([pools.app?.sql.end(), pools.owner?.sql.end()])
  pools.app = undefined
  pools.owner = undefined
}
