import type { Billing } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import { failJob } from '@genny/db/repositories/jobs.ts'

/**
 * Give the credits back, then mark the row. A generation that failed costs
 * nothing, and releasing first means a crash between the two leaves the money
 * returned rather than stranded.
 *
 * If the release itself fails the row is deliberately left alone. The sweep only
 * lists jobs that are still queued or running, so marking this one failed would
 * be the last time anything looked at it and the hold would sit there forever.
 * Leaving it unfinished costs the user a stale spinner and buys another sweep.
 *
 * Shared with the reconcile sweep, which reaches the same conclusion by a
 * different route and must not settle it differently.
 */
export async function releaseAndFail(input: {
  db: Database
  actorId: string
  jobId: string
  held: string
  billing: Billing
  message: string
}): Promise<boolean> {
  if (Number(input.held) > 0) {
    const released = await input.billing
      .release(input.actorId, input.held)
      .then(() => true)
      .catch((error: unknown) => {
        console.error('[settle] could not release a hold, leaving the job for the sweep', {
          jobId: input.jobId,
          error: error instanceof Error ? error.message : 'unknown error',
        })
        return false
      })
    if (!released) return false
  }
  return await withActor(input.db, input.actorId, (tx) => failJob(tx, input.jobId, input.message))
    .then(() => true)
    .catch((error: unknown) => {
      console.error('[settle] could not mark a job failed', {
        jobId: input.jobId,
        error: error instanceof Error ? error.message : 'unknown error',
      })
      return false
    })
}
