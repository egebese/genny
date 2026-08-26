import { eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { users } from '../schema/auth.ts'

export type Actor = {
  id: string
  kind: 'anonymous' | 'registered'
  role: 'user' | 'admin'
  /** The plan they pay for, or null for anonymous and free actors. */
  planId: string | null
}

/**
 * Creates the row an anonymous visitor's assets and jobs will belong to.
 *
 * Takes the elevated connection on purpose: `users` grants the app role a
 * read-your-own-row policy and nothing else, so an actor cannot conjure itself
 * into existence. Called once, from the code that issues the signed cookie.
 */
export async function createAnonymousActor(db: Database, id: string): Promise<Actor> {
  const [row] = await db
    .insert(users)
    .values({ id, kind: 'anonymous' })
    .onConflictDoNothing()
    .returning({ id: users.id, kind: users.kind, role: users.role, planId: users.planId })

  return row ?? { id, kind: 'anonymous', role: 'user', planId: null }
}

/** Reads an actor with the elevated connection, for code that has no actor context yet. */
export async function findActor(db: Database, id: string): Promise<Actor | null> {
  const [row] = await db
    .select({ id: users.id, kind: users.kind, role: users.role, planId: users.planId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Records which plan an actor pays for, or clears it when the subscription ends.
 *
 * Elevated connection: this is written by the Stripe webhook, which arrives with
 * no session and no actor to scope a policy against.
 */
export async function setActorPlan(db: Database, id: string, planId: string | null): Promise<void> {
  await db.update(users).set({ planId }).where(eq(users.id, id))
}

export type Credentials = {
  id: string
  email: string
  name: string | null
  passwordHash: string | null
}

/**
 * Looks someone up by email for a password sign-in.
 *
 * Elevated connection: there is no actor yet, which is the whole point. Emails
 * are matched case-insensitively because people do not remember how they typed
 * theirs, and stored lowercased so this stays an index lookup.
 */
export async function findCredentials(db: Database, email: string): Promise<Credentials | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)
  return row?.email ? { ...row, email: row.email } : null
}

/** Writes a new hash. Used by registration and, later, by a password change. */
export async function setPasswordHash(db: Database, id: string, hash: string): Promise<void> {
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, id))
}
