import { findPlan } from '@genny/billing/plans.ts'
import { type LedgerEntry, listLedger, spentSince } from '@genny/billing/usage.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { findActor } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import { GENERATION_LIMITS, tierOf } from '@genny/ratelimit/rules.ts'

export type UsageReport = {
  planName: string
  hourlyLimit: number
  thisMonth: { credits: string; generations: number }
  entries: LedgerEntry[]
}

const ENTRY_LIMIT = 50

/** Everything the usage page shows, in two reads over the ledger and one over the actor. */
export async function usageReport(actorId: string): Promise<UsageReport> {
  const config = env()
  const actor = await findActor(
    ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL),
    actorId,
  )
  const tier = actor ? tierOf(actor) : 'anonymous'

  const db = appDb(config.DATABASE_URL)
  const [thisMonth, entries] = await withActor(db, actorId, async (tx) => [
    await spentSince(tx, actorId, startOfMonth()),
    await listLedger(tx, actorId, ENTRY_LIMIT),
  ])

  return {
    planName: findPlan(actor?.planId ?? '')?.name ?? 'Free',
    hourlyLimit: GENERATION_LIMITS[tier].limit,
    thisMonth,
    entries,
  }
}

function startOfMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
