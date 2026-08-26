import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { falKeyInput } from '@genny/fal/key-input.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { clearFalKey, storeFalKey } from '@/features/session/fal-key.ts'

/*
 * A route handler rather than a server action, on purpose.
 *
 * Next's dev logger prints server action arguments, so passing a fal key as an
 * action argument writes somebody else's credential into the terminal in plain
 * text. A request body is not logged. Anything secret enters the server this way.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = falKeyInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return reject(parsed.error.issues[0]?.message ?? 'That key is not valid.', 400)
  }

  const actorId = await ensureActorId()
  const verdict = await createPostgresLimiter(appDb(env().DATABASE_URL)).check(
    ruleFor('keyAttempt', actorId),
  )
  if (!verdict.allowed) return reject('Too many attempts. Try again shortly.', 429)

  /*
   * The key is not probed against fal first. The obvious probe, asking for the
   * status of a request id that cannot exist, answers 403 for a perfectly good
   * key, so it rejected real keys. A wrong key now surfaces at the first
   * generation, where the error is already classified and shown as
   * "That fal key was rejected".
   */
  await storeFalKey(parsed.data.key)
  return Response.json({ ok: true })
}

export async function DELETE(): Promise<Response> {
  await clearFalKey()
  return Response.json({ ok: true })
}

function reject(reason: string, status: number): Response {
  return Response.json({ ok: false, reason }, { status })
}
