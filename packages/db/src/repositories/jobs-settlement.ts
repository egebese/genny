import { and, eq, lt, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { jobs } from '../schema/jobs.ts'
import { columns, type JobRecord } from './jobs.ts'

/**
 * Queries for the things that finish a job when its browser is not there: the
 * reconcile sweep, and fal's webhook. All of them span every actor, so all of
 * them run on the owner connection and carry the owner id themselves.
 */
export type StrandedJob = JobRecord & { ownerId: string }

/**
 * Jobs that stopped being watched. The browser holding the stream is the only
 * thing that finishes a job, so a closed tab leaves the row queued and, in saas
 * mode, its credits reserved forever.
 *
 * Owner-agnostic on purpose, which means the caller has to be the owner
 * connection: there is no actor to scope this to. `inArray` on the status uses
 * the partial index that covers exactly these two states.
 */
export async function listStrandedJobs(
  tx: Database,
  options: { olderThan: Date; limit: number },
): Promise<StrandedJob[]> {
  const rows = await tx
    .select({ ...columns, ownerId: jobs.ownerId })
    .from(jobs)
    .where(and(sql`status in ('queued', 'running')`, lt(jobs.createdAt, options.olderThan)))
    .orderBy(jobs.createdAt)
    .limit(Math.min(options.limit, 200))
  return rows as StrandedJob[]
}

/**
 * The job a fal webhook is talking about.
 *
 * Owner-agnostic, so the caller has to be the owner connection: a webhook
 * arrives with no session and no actor, only fal's word for which request it is.
 */
export async function findJobByFalRequestId(
  tx: Database,
  falRequestId: string,
): Promise<StrandedJob | null> {
  const rows = await tx
    .select({ ...columns, ownerId: jobs.ownerId })
    .from(jobs)
    .where(eq(jobs.falRequestId, falRequestId))
    .limit(1)
  return (rows[0] as StrandedJob | undefined) ?? null
}

/**
 * Claims the right to settle a job, or reports that someone else has it.
 *
 * The browser's stream and fal's webhook can both notice the same generation
 * finished, and both would download and store the outputs. This is the coin
 * toss: one conditional update, and only the winner ingests anything.
 *
 * A claim older than `staleAfterMs` is taken over, so a settler that crashed
 * mid-ingest costs one retry rather than one permanently stuck job.
 */
export async function claimJobSettlement(
  tx: Database,
  jobId: string,
  staleAfterMs: number,
): Promise<boolean> {
  const rows = await tx
    .update(jobs)
    .set({ settlingAt: new Date() })
    .where(
      and(
        eq(jobs.id, jobId),
        sql`status in ('queued', 'running')`,
        sql`(settling_at is null or settling_at < now() - make_interval(secs => ${staleAfterMs / 1000}))`,
      ),
    )
    .returning({ id: jobs.id })
  return rows.length > 0
}
