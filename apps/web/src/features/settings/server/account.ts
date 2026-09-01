'use server'

import { listAssets } from '@genny/assets/repository.ts'
import { THUMB_WIDTHS, thumbKeyFor } from '@genny/assets/thumbnail.ts'
import { hashPassword, verifyPassword } from '@genny/auth/password.ts'
import { changePasswordRequest } from '@genny/auth/register.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { deleteActor, findPasswordHash, setPasswordHash } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { logger, reason } from '@genny/env/log.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { signOut } from '@/features/auth/config.ts'
import { readActorId } from '@/features/session/actor.ts'
import { storage } from '@/features/storage.ts'

type Outcome = { ok: boolean; reason?: string }

/**
 * Changing a password.
 *
 * `setPasswordHash` has existed since registration landed, with a comment
 * saying it was for this, and nothing ever called it. The current password is
 * checked first: a session that has been left open on a shared machine should
 * not be enough to lock the owner out of their own account.
 *
 * The elevated connection, because `users` has a select-only policy for the app
 * role. That is the correct default and this is one of the two places that has
 * to go around it.
 */
export async function changePassword(raw: unknown): Promise<Outcome> {
  const parsed = changePasswordRequest.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, reason: 'A new password needs at least 8 characters.' }
  }
  const actorId = await readActorId()
  if (!actorId) return { ok: false, reason: 'Sign in first.' }

  const config = env()
  const verdict = await createPostgresLimiter(appDb(config.DATABASE_URL)).check(
    ruleFor('passwordChange', actorId),
  )
  if (!verdict.allowed) return { ok: false, reason: 'Too many attempts. Try again later.' }

  const db = ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL)
  const current = await findPasswordHash(db, actorId)
  if (!current) return { ok: false, reason: 'This account has no password to change.' }
  if (!(await verifyPassword(parsed.data.current, current))) {
    return { ok: false, reason: 'That is not the current password.' }
  }

  await setPasswordHash(db, actorId, await hashPassword(parsed.data.next))
  return { ok: true }
}

/**
 * Deleting an account and everything in it.
 *
 * Every table carrying an `owner_id` cascades from `users`, so the database
 * half is one statement. Two things that cascade cannot do are handled here.
 *
 * The bucket, first and deliberately: a foreign key cascade knows nothing about
 * object storage, so deleting the rows first would leave every file orphaned
 * with nothing left pointing at it to find them by. Best effort, because a
 * bucket that is briefly unreachable must not become a reason somebody cannot
 * close their account.
 *
 * The ledger goes too, which is the decision written down in ADR 0013: the
 * ledger is append-only by grant, but a cascade runs as the table owner and is
 * subject to neither RLS nor that REVOKE, so "delete my account" is taken to
 * mean the whole of it.
 */
export async function deleteAccount(): Promise<Outcome> {
  const actorId = await readActorId()
  if (!actorId) return { ok: false, reason: 'Sign in first.' }

  const config = env()
  await emptyBucket(actorId, appDb(config.DATABASE_URL))

  const gone = await deleteActor(
    ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL),
    actorId,
  )
  if (!gone) return { ok: false, reason: 'Nothing to delete.' }

  // Sessions are JWTs, so there is nothing on the server to revoke: the token
  // in this browser would keep naming a row that no longer exists until it
  // expired on its own. Signing out is what actually ends it.
  await signOut({ redirectTo: '/' })
  return { ok: true }
}

async function emptyBucket(actorId: string, db: ReturnType<typeof appDb>): Promise<void> {
  const store = storage()
  /*
   * Paged, not one call. `listAssets` caps at a hundred rows, so a single pass
   * would quietly leave everything beyond the hundredth most recent file in the
   * bucket with nothing left pointing at it. The cursor is the createdAt of the
   * last row, which is what the repository's keyset pagination expects.
   */
  let before: Date | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const owned = await withActor(db, actorId, (tx) => listAssets(tx, { limit: 100, before }))
    if (owned.length === 0) return

    const keys = owned.flatMap((asset) => [
      asset.storageKey,
      ...THUMB_WIDTHS.map((width) => thumbKeyFor(asset.storageKey, width)),
    ])
    await Promise.all(
      keys.map((key) =>
        store.remove(key).catch((error: unknown) => {
          log.error('object left behind after an account delete', { key, reason: reason(error) })
        }),
      ),
    )

    if (owned.length < 100) return
    before = owned[owned.length - 1]?.createdAt
  }
  log.warn('stopped emptying a bucket early', { actorId, pages: MAX_PAGES })
}

/** A rail, not a rule: a hundred thousand files is a runaway rather than a
 * library, and the account still gets deleted either way. */
const MAX_PAGES = 1000

const log = logger('assets')
