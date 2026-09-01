import type { Database } from '@genny/db/client.ts'
import { findCredentials, setPasswordHash } from '@genny/db/repositories/actors.ts'
import { z } from 'zod'
import { hashPassword } from './password.ts'
import { promoteAnonymousActor } from './promote.ts'

/**
 * Eight characters is the floor, and there is no upper complexity rule.
 * Composition rules push people towards Passw0rd! and a length floor does more
 * for them than a symbol requirement ever did. The cap is there so nobody can
 * make us scrypt a megabyte.
 */
export const credentialsSchema = z.object({
  /*
   * Trimmed and lowercased before validation, not after. A transform runs on the
   * way out, so an address pasted with a trailing space would be rejected as
   * malformed rather than cleaned up, which is a confusing thing to tell someone
   * about an address that is perfectly fine.
   */
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(200),
})

export type SignUpResult = { ok: true; userId: string } | { ok: false; reason: string }

/**
 * Registers an email and password, keeping whatever the visitor already made.
 *
 * The anonymous actor is promoted rather than replaced, so someone who generated
 * ten images before signing up still owns them. That is the difference between
 * signing up and starting over.
 */
export async function registerWithPassword(
  db: Database,
  input: { email: string; password: string; anonymousId: string | null },
): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'Use a real email address and a password of at least 8 characters.',
    }
  }
  const { email, password } = parsed.data

  if (await findCredentials(db, email)) {
    return { ok: false, reason: 'That email already has an account. Sign in instead.' }
  }
  if (!input.anonymousId) {
    // Every visitor gets an anonymous actor on their first request, so there is
    // no honest path here: something dropped the cookie mid-signup.
    return { ok: false, reason: 'Your session expired. Reload the page and try again.' }
  }

  const promotion = await promoteAnonymousActor(db, input.anonymousId, { email })
  if (promotion.outcome === 'no-such-actor') {
    return { ok: false, reason: 'Your session expired. Reload the page and try again.' }
  }
  if (promotion.outcome === 'already-registered') {
    return { ok: false, reason: 'You are already signed in.' }
  }
  if (promotion.outcome === 'email-taken') {
    return { ok: false, reason: 'That email already has an account. Sign in instead.' }
  }

  // Hashed after the row is claimed, so a crash leaves an account nobody can log
  // into rather than a password attached to the wrong actor.
  await setPasswordHash(db, promotion.userId, await hashPassword(password))
  return { ok: true, userId: promotion.userId }
}

/**
 * Changing a password.
 *
 * The current one travels with the request rather than being implied by the
 * session: a browser left open on a shared machine should not be enough to lock
 * somebody out of their own account. Bounded exactly as `credentialsSchema`
 * bounds it, since the two write the same column.
 */
export const changePasswordRequest = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
})
