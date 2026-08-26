import {
  ANONYMOUS_COOKIE,
  issueAnonymousActor,
  verifyAnonymousActor,
} from '@genny/auth/anonymous.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { createAnonymousActor } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { cookies } from 'next/headers'

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365

/**
 * Reads the actor from its signed cookie. Returns null rather than creating one,
 * because a server component cannot set a cookie: only an action or a route
 * handler can, and pretending otherwise fails at runtime in a confusing way.
 */
export async function readActorId(): Promise<string | null> {
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
  // The row comes first: a cookie pointing at an actor that does not exist makes
  // every subsequent query fail its foreign key instead of its policy.
  await createAnonymousActor(ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL), actorId)

  const jar = await cookies()
  jar.set(ANONYMOUS_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR_IN_SECONDS,
  })
  return actorId
}
