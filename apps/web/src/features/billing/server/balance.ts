import { readBalance } from '@genny/billing/ledger.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'

export type CreditBalance = { credits: number; held: number }

/**
 * What the actor can spend, and what is currently reserved by running jobs.
 *
 * Null in byok mode: there is no ledger there, and showing a zero would read as
 * "out of credits" rather than "credits do not apply here".
 */
export async function creditBalance(actorId: string | null): Promise<CreditBalance | null> {
  if (env().GENNY_MODE !== 'saas' || !actorId) return null

  const balance = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    readBalance(tx, actorId),
  )
  return {
    credits: Math.floor(Number(balance.balance)),
    held: Math.floor(Number(balance.holdBalance)),
  }
}
