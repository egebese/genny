import {
  ANONYMOUS_COOKIE,
  issueAnonymousActor,
  verifyAnonymousActor,
} from '@genny/auth/anonymous.ts'
import { recordChange } from '@genny/billing/ledger.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { createAnonymousActor } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { type NextRequest, NextResponse } from 'next/server'
import { secureCookies } from '@/features/session/cookie-flags.ts'

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365

/**
 * Issues the anonymous actor on the first request rather than on the first
 * action.
 *
 * A server component cannot set a cookie, so without this a visitor has no actor
 * until they do something, and until then there is no balance to show and nothing
 * to own an upload. Middleware is the one place that runs before rendering and
 * can still write a cookie.
 */
export async function middleware(request: NextRequest) {
  const secret = env().AUTH_SECRET
  if (verifyAnonymousActor(request.cookies.get(ANONYMOUS_COOKIE)?.value, secret)) {
    return NextResponse.next()
  }

  const { actorId, cookieValue } = issueAnonymousActor(secret)
  const db = ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL)

  // The row first: a cookie pointing at an actor that does not exist makes every
  // later query fail its foreign key instead of its policy.
  await createAnonymousActor(db, actorId)
  if (env().GENNY_MODE === 'saas' && env().CREDIT_SIGNUP_GRANT > 0) {
    await recordChange(db, {
      ownerId: actorId,
      delta: String(env().CREDIT_SIGNUP_GRANT),
      kind: 'grant',
      idempotencyKey: `signup:${actorId}`,
      note: 'trial credits',
    })
  }

  const response = NextResponse.next()
  response.cookies.set(ANONYMOUS_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: YEAR_IN_SECONDS,
  })
  return response
}

export const config = {
  // Node, because this talks to Postgres.
  runtime: 'nodejs',
  /*
   * Pages and API routes only. Static assets and images would each pay for a
   * database round trip on a cold visit for nothing.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
