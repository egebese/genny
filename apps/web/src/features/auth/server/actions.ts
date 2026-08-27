'use server'

import { credentialsSchema, registerWithPassword } from '@genny/auth/register.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { ensureActorId, forgetAnonymousActor, readActorId } from '@/features/session/actor.ts'
import { signIn } from '../config.ts'

export type FormState = { error: string | null }

/**
 * Registers, then signs in with the same credentials.
 *
 * The anonymous actor is promoted, so whatever the visitor already generated is
 * still theirs afterwards. Signing in immediately is the point: an account they
 * have to go and log into separately is a step nobody asked for.
 */
export async function signUpAction(_state: FormState, form: FormData): Promise<FormState> {
  const input = readForm(form)

  // ensure, not read: someone can land on /signup before anything issued them an
  // actor, and there would be nothing to promote.
  const anonymousId = await ensureActorId()
  const outcome = await registerWithPassword(authDb(), { ...input, anonymousId })
  if (!outcome.ok) return { error: outcome.reason }

  // The account owns this actor now, and the cookie that used to name it would
  // outlive every sign-out.
  await forgetAnonymousActor()
  return attempt(input)
}

/** Signs in an existing account. Rate limited per email, not per session. */
export async function signInAction(_state: FormState, form: FormData): Promise<FormState> {
  const input = readForm(form)

  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Check the email and password and try again.' }

  const verdict = await createPostgresLimiter(appDb(env().DATABASE_URL)).check(
    ruleFor('signIn', parsed.data.email),
  )
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil((verdict.resetAt.getTime() - Date.now()) / 60_000))
    return { error: `Too many attempts. Try again in about ${minutes} minutes.` }
  }

  return attempt(parsed.data)
}

export async function signOutToHome(): Promise<void> {
  const { signOut } = await import('../config.ts')
  await forgetAnonymousActor()
  await signOut({ redirectTo: '/c' })
}

/**
 * One answer for a wrong password and an unknown email, because the difference
 * is a way to find out which emails have accounts.
 */
async function attempt(input: { email: string; password: string }): Promise<FormState> {
  try {
    await signIn('credentials', { ...input, redirect: false })
  } catch (error) {
    /*
     * Only a rejected credential is reported as one. Anything else is our
     * problem, not theirs: an UntrustedHost misconfiguration once presented
     * itself as "wrong password" to everybody, which is a bug that hides itself.
     */
    if (error instanceof AuthError && error.type === 'CredentialsSignin') {
      return { error: 'That email and password do not match an account.' }
    }
    console.error('[auth] sign-in failed', error)
    return { error: 'Sign-in is not working right now. This is our fault, not yours.' }
  }
  // Outside the try: redirect works by throwing, and catching it here would turn
  // a successful sign-in into an error message.
  redirect(await landing())
}

async function landing(): Promise<string> {
  return (await readActorId()) ? '/c' : '/signin'
}

function readForm(form: FormData): { email: string; password: string } {
  return {
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  }
}

function authDb() {
  return ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL)
}
