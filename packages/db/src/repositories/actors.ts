import { eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { users } from '../schema/auth.ts'

export type Actor = {
  id: string
  kind: 'anonymous' | 'registered'
  role: 'user' | 'admin'
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
    .returning({ id: users.id, kind: users.kind, role: users.role })

  return row ?? { id, kind: 'anonymous', role: 'user' }
}

/** Reads an actor with the elevated connection, for code that has no actor context yet. */
export async function findActor(db: Database, id: string): Promise<Actor | null> {
  const [row] = await db
    .select({ id: users.id, kind: users.kind, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return row ?? null
}
