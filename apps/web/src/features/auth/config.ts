import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { ANONYMOUS_COOKIE, verifyAnonymousActor } from '@genny/auth/anonymous.ts'
import { verifyPassword } from '@genny/auth/password.ts'
import { promoteAnonymousActor } from '@genny/auth/promote.ts'
import { credentialsSchema } from '@genny/auth/register.ts'
import { ownerDb } from '@genny/db/connection.ts'
import { findCredentials } from '@genny/db/repositories/actors.ts'
import { accounts, sessions, users, verificationTokens } from '@genny/db/schema/auth.ts'
import { env } from '@genny/env/env.ts'
import { cookies } from 'next/headers'
import NextAuth, { type NextAuthConfig } from 'next-auth'
import type { Adapter, AdapterUser } from 'next-auth/adapters'
import Credentials from 'next-auth/providers/credentials'
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
 * Email and password always; Google as well when it is configured. Password
 * sign-in needs nothing from anyone else, which is why it is the one that is
 * always there.
 */
function providers() {
  const { AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET } = env()
  const google =
    AUTH_GOOGLE_ID && AUTH_GOOGLE_SECRET
      ? [Google({ clientId: AUTH_GOOGLE_ID, clientSecret: AUTH_GOOGLE_SECRET })]
      : []

  return [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const account = await findCredentials(authDb(), parsed.data.email)
        /*
         * The hash is verified even when there is no account, against a hash of
         * nothing. Returning early on an unknown email answers in a millisecond
         * while a known one takes a hundred, and that difference is a list of
         * which emails are registered.
         */
        const ok = await verifyPassword(parsed.data.password, account?.passwordHash ?? DUMMY_HASH)
        if (!ok || !account) return null

        return { id: account.id, email: account.email, name: account.name }
      },
    }),
    ...google,
  ]
}

/*
 * A real scrypt hash of a password nobody has, so an unknown email costs the
 * same as a known one. Generated once at module load rather than per request.
 */
const DUMMY_HASH =
  'scrypt$32768$8$1$Y2FuYXJ5Y2FuYXJ5Y2FuYXJ5Y2E=$3q2+7wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const authConfig: NextAuthConfig = {
  adapter: promotingAdapter(),
  providers: providers(),
  secret: env().AUTH_SECRET,
  /*
   * JWT rather than database sessions: the credentials provider has no account
   * row to hang a session off, so Auth.js requires it. The adapter stays for the
   * OAuth path and for the user table itself.
   */
  session: { strategy: 'jwt' },
  /*
   * Without this a production build refuses every request with UntrustedHost,
   * and the symptom is not a page that says so: sign-in silently does nothing.
   *
   * It means Auth.js takes the origin from the Host header, so put a proxy in
   * front that sets it, or pin AUTH_URL. Only OAuth callback urls are built from
   * it, and Google checks its own registered redirect anyway; a password sign-in
   * never leaves the origin.
   */
  trustHost: true,
  basePath: '/api/auth',
  pages: { signIn: '/signin' },
  callbacks: {
    jwt({ token, user }) {
      // Only present on the request that signed in; afterwards it rides the token.
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      // The actor id is what every RLS policy compares against, so it has to be
      // on the session rather than looked up again on each request.
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)

/** True when this deployment can actually sign anyone in. Always, now. */
export function signInAvailable(): boolean {
  return providers().length > 0
}
