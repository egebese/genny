import {
  ANONYMOUS_COOKIE,
  issueAnonymousActor,
  verifyAnonymousActor,
} from '@genny/auth/anonymous.ts'
import { recordChange } from '@genny/billing/ledger.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { createAnonymousActor } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { cookies } from 'next/headers'
import { auth } from '@/features/auth/config.ts'
import { secureCookies } from './cookie-flags.ts'

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365

/**
 * Who this request is acting as.
 *
 * The signed-in account wins over the anonymous cookie, and that is the whole
 * point of signing in: the same person on a second browser has a different
 * anonymous actor there, so without this they would sign in and still see none
 * of their own work.
 *
 * Returns null rather than creating an actor, because a server component cannot
 * set a cookie: only an action or a route handler can, and pretending otherwise
 * fails at runtime in a confusing way.
 */
export async function readActorId(): Promise<string | null> {
  const session = await auth().catch(() => null)
  if (session?.user?.id) return session.user.id

  const jar = await cookies()
  return verifyAnonymousActor(jar.get(ANONYMOUS_COOKIE)?.value, env().AUTH_SECRET)
}

/**
 * Reads the actor, or creates one and sets its cookie. Only callable from a
 * server action or a route handler.
 */
export async function ensureActorId(): Promise<string> {
  const existing = await readActorId()
  if (existing) return existing

  const { actorId, cookieValue } = issueAnonymousActor(env().AUTH_SECRET)
  const db = ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL)

  // The row comes first: a cookie pointing at an actor that does not exist makes
  // every subsequent query fail its foreign key instead of its policy.
  await createAnonymousActor(db, actorId)
  await grantSignupCredits(db, actorId)

  const jar = await cookies()
  jar.set(ANONYMOUS_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: YEAR_IN_SECONDS,
  })
  return actorId
}

/**
 * Trial credits, if the operator configured any. saas mode only: in byok the
 * visitor is spending their own fal balance and has nothing to be granted.
 *
 * Normally the middleware has already done this on the first request. This is
 * the fallback for a request that reached an action without passing through it.
 * Idempotent on the actor id, so the two paths cannot double-grant.
 */
async function grantSignupCredits(db: ReturnType<typeof ownerDb>, actorId: string): Promise<void> {
  const amount = env().CREDIT_SIGNUP_GRANT
  if (env().GENNY_MODE !== 'saas' || amount <= 0) return

  await recordChange(db, {
    ownerId: actorId,
    delta: String(amount),
    kind: 'grant',
    idempotencyKey: `signup:${actorId}`,
    note: 'trial credits',
  })
}

/**
 * Drops the anonymous cookie.
 *
 * Promotion keeps the actor id, so after signing up the anonymous cookie still
 * names the account: leaving it in place means signing out does not sign you
 * out, and the next person at the machine is you. Clearing it makes the browser
 * a stranger again, and the middleware issues it a fresh actor on the next
 * request.
 */
export async function forgetAnonymousActor(): Promise<void> {
  const jar = await cookies()
  jar.delete(ANONYMOUS_COOKIE)
}
