import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { ANONYMOUS_COOKIE, verifyAnonymousActor } from '@genny/auth/anonymous.ts'
import { promoteAnonymousActor } from '@genny/auth/promote.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { accounts, sessions, users, verificationTokens } from '@genny/db/schema/auth.ts'
import { env } from '@genny/env/env.ts'
import { cookies } from 'next/headers'
import NextAuth, { type NextAuthConfig } from 'next-auth'
import type { Adapter, AdapterUser } from 'next-auth/adapters'
import Google from 'next-auth/providers/google'

/**
 * The adapter runs on the elevated connection, not the app one.
 *
 * Sign-in has to look up an account before any actor context exists, and the auth
 * tables deliberately grant `genny_app` nothing at all. This is the only code
 * that touches them.
 */
function authDb() {
  return ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL)
}

/**
 * Wraps the adapter so signing in promotes the visitor's existing anonymous actor
 * instead of creating a second row beside it.
 *
 * `createUser` is the only hook that runs at exactly the right moment: after the
 * provider has confirmed who this is, and before anything is written. Doing it in
 * a callback instead would mean a new user already exists and every asset would
 * have to be moved to it.
 */
function promotingAdapter() {
  const db = authDb()
  const tables = {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }
  /*
   * The adapter's table types predate exactOptionalPropertyTypes and reject a
   * schema that satisfies them structurally. One suppression here is better than
   * loosening the setting for the whole repo, and it is scoped to this call.
   */
  // @ts-expect-error -- see above
  const base: Adapter = DrizzleAdapter(db, tables)

  return {
    ...base,
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const jar = await cookies()
      const anonymousId = verifyAnonymousActor(jar.get(ANONYMOUS_COOKIE)?.value, env().AUTH_SECRET)

      if (anonymousId) {
        const result = await promoteAnonymousActor(db, anonymousId, {
          email: user.email,
          name: user.name,
          image: user.image,
        })
        if (result.outcome === 'promoted' || result.outcome === 'email-taken') {
          return {
            id: result.userId,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: null,
          }
        }
      }
      if (!base.createUser) throw new Error('the drizzle adapter has no createUser')
      return base.createUser(user)
    },
  } satisfies Adapter
}

/**
 * Google only, and only when it is configured. A deployment without OAuth
 * credentials still runs: it simply has no way to sign in, which is exactly the
 * byok demo's situation.
 */
function providers() {
  const { AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET } = env()
  if (!AUTH_GOOGLE_ID || !AUTH_GOOGLE_SECRET) return []
  return [Google({ clientId: AUTH_GOOGLE_ID, clientSecret: AUTH_GOOGLE_SECRET })]
}

export const authConfig: NextAuthConfig = {
  adapter: promotingAdapter(),
  providers: providers(),
  secret: env().AUTH_SECRET,
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      // The actor id is what every RLS policy compares against, so it has to be
      // on the session rather than looked up again on each request.
      session.user.id = user.id
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)

/** True when this deployment can actually sign anyone in. */
export function signInAvailable(): boolean {
  return providers().length > 0
}
