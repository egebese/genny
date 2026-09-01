import type { Storage } from '@genny/assets/storage.ts'
import type { Billing } from '@genny/billing/provider.ts'
import type { Database } from '@genny/db/client.ts'
import { listStrandedJobs, type StrandedJob } from '@genny/db/repositories/jobs-settlement.ts'
import { logger } from '@genny/env/log.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { releaseAndFail } from './failure.ts'
import { settleOnce } from './track.ts'

/** How long a job may go unwatched before the sweep takes an interest. */
export const STALE_AFTER_MS = 3 * 60 * 1000
/** Past this, the job is written off whatever fal says about it. */
export const ABANDON_AFTER_MS = 60 * 60 * 1000

export type SweepReport = {
  /** Rows the sweep looked at. */
  checked: number
  /** Rows fal gave a verdict on, completed or failed. */
  settled: number
  /** Rows given up on, credits returned. */
  expired: number
  /** Rows that should have expired but whose credits would not go back. Left
   * queued for the next pass; a number that stays above zero is an alarm. */
  stuck: number
}

export type SweepOptions = {
  /** RLS connection: settling a job writes as its owner. */
  db: Database
  /** Owner connection: the listing spans every actor, so it has no actor. */
  ownerDb: Database
  /**
   * What the sweep needs to ask fal for a verdict, or null when it cannot ask.
   * Null in byok, where the key belonged to the visitor and left with them; the
   * sweep can then only expire jobs, never finish them.
   */
  fal: { credentials: FalCredentials; storage: Storage } | null
  billing: Billing
  now?: Date
  staleAfterMs?: number
  abandonAfterMs?: number
  limit?: number
}

/**
 * Finishes what the browser did not.
 *
 * A generation is driven by the stream the browser holds open, so a closed tab
 * leaves the row queued and its credits reserved. Nothing else ever revisits it:
 * fal has the answer and no one is asking.
 *
 * The sweep asks. Where the deployment owns the fal key it settles the job for
 * real, ingesting outputs and capturing the right amount. Where it cannot ask,
 * or where fal still has nothing an hour later, it gives the credits back and
 * marks the row failed, because a job that is neither finished nor refunded is
 * the one outcome a user cannot recover from.
 */
export async function sweepStrandedJobs(options: SweepOptions): Promise<SweepReport> {
  const now = options.now ?? new Date()
  const staleAfter = options.staleAfterMs ?? STALE_AFTER_MS
  const abandonAfter = options.abandonAfterMs ?? ABANDON_AFTER_MS

  const stranded = await listStrandedJobs(options.ownerDb, {
    olderThan: new Date(now.getTime() - staleAfter),
    limit: options.limit ?? 50,
  })

  const report: SweepReport = { checked: stranded.length, settled: 0, expired: 0, stuck: 0 }

  for (const job of stranded) {
    const settled = await askFal(options, job)
    if (settled) {
      report.settled += 1
      continue
    }
    if (now.getTime() - job.createdAt.getTime() < abandonAfter) continue

    const expired = await releaseAndFail({
      db: options.db,
      actorId: job.ownerId,
      jobId: job.id,
      held: job.creditsHeld ?? '0',
      billing: options.billing,
      message: 'This generation never came back. Any credits held for it were returned.',
    })
    // A refusal leaves the row queued on purpose, so the next sweep sees it
    // again. Counting it as expired would report money returned that is not.
    if (expired) report.expired += 1
    else report.stuck += 1
  }

  // Always, not only when it did something: a run that checked nothing is how a
  // deployment proves its scheduler is alive, and a `stuck` above zero is money
  // that did not go back.
  log.info('sweep finished', { ...report })
  return report
}

const log = logger('jobs')

/**
 * True when fal gave a verdict and the job is now finished either way.
 *
 * A throw here is not a failure of the job, only of this attempt: the next sweep
 * tries again, and the abandon deadline is what eventually stops the retrying.
 */
async function askFal(options: SweepOptions, job: StrandedJob): Promise<boolean> {
  if (!options.fal || !job.falRequestId) return false

  try {
    const step = await settleOnce({
      db: options.db,
      actorId: job.ownerId,
      job: { ...job, falRequestId: job.falRequestId },
      credentials: options.fal.credentials,
      billing: options.billing,
      storage: options.fal.storage,
    })
    return step.terminal
  } catch {
    return false
  }
}
