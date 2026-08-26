import type { Database } from '@genny/db/client.ts'
import { users } from '@genny/db/schema/auth.ts'
import { eq } from 'drizzle-orm'

export type SignedInProfile = {
  email: string
  name?: string | null | undefined
  image?: string | null | undefined
}

export type PromotionResult =
  | { outcome: 'promoted'; userId: string }
  | { outcome: 'already-registered'; userId: string }
  | { outcome: 'email-taken'; userId: string }
  | { outcome: 'no-such-actor' }

/**
 * Turns the anonymous actor a visitor already has into a registered one.
 *
 * Promotion rather than migration: the `users` row keeps its id, so every asset,
 * character and job it owns keeps its owner and nothing has to be copied. Someone
 * who generated ten images before signing up keeps them, which is the difference
 * between signing up and starting over.
 *
 * Runs on the elevated connection: sign-in happens before any actor context
 * exists, which is also why the auth tables grant the app role nothing.
 */
export async function promoteAnonymousActor(
  db: Database,
  anonymousId: string,
  profile: SignedInProfile,
): Promise<PromotionResult> {
  const [existingActor] = await db
    .select({ id: users.id, kind: users.kind })
    .from(users)
    .where(eq(users.id, anonymousId))
    .limit(1)

  if (!existingActor) return { outcome: 'no-such-actor' }
  if (existingActor.kind === 'registered') {
    return { outcome: 'already-registered', userId: existingActor.id }
  }

  /*
   * Somebody signing in on a second device already has a registered row under
   * this email. Promoting the local anonymous actor would create a duplicate
   * account, so hand back the established one instead. What the anonymous actor
   * made stays where it is; merging accounts is a decision for a person, not a
   * side effect of signing in.
   */
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1)
  if (owner) return { outcome: 'email-taken', userId: owner.id }

  const [promoted] = await db
    .update(users)
    .set({
      kind: 'registered',
      email: profile.email,
      name: profile.name ?? null,
      image: profile.image ?? null,
      emailVerified: new Date(),
    })
    .where(eq(users.id, anonymousId))
    .returning({ id: users.id })

  if (!promoted) return { outcome: 'no-such-actor' }
  return { outcome: 'promoted', userId: promoted.id }
}
