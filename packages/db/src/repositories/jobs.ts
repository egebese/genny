import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { jobs } from '../schema/jobs.ts'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'

export type StoredPrompt = {
  text: string
  references: { token: string; label: string; kind: 'asset' | 'character'; id: string }[]
}

export type JobRecord = {
  id: string
  endpointId: string
  status: JobStatus
  falRequestId: string | null
  prompt: StoredPrompt
  input: Record<string, unknown>
  output: unknown
  error: string | null
  creditsHeld: string | null
  creditsCharged: string | null
  createdAt: Date
  finishedAt: Date | null
}

const columns = {
  id: jobs.id,
  endpointId: jobs.endpointId,
  status: jobs.status,
  falRequestId: jobs.falRequestId,
  prompt: jobs.prompt,
  input: jobs.input,
  output: jobs.output,
  error: jobs.error,
  creditsHeld: jobs.creditsHeld,
  creditsCharged: jobs.creditsCharged,
  createdAt: jobs.createdAt,
  finishedAt: jobs.finishedAt,
}

export async function createJob(
  tx: Database,
  input: {
    ownerId: string
    endpointId: string
    prompt: StoredPrompt
    input: Record<string, unknown>
    creditsHeld?: string | undefined
  },
): Promise<JobRecord> {
  const [row] = await tx
    .insert(jobs)
    .values({
      ownerId: input.ownerId,
      endpointId: input.endpointId,
      prompt: input.prompt,
      input: input.input,
      creditsHeld: input.creditsHeld ?? null,
    })
    .returning(columns)
  if (!row) throw new Error('job insert returned no row')
  return row as JobRecord
}

/**
 * Records the fal request id. Separate from creation because the row has to exist
 * before we submit: if the submit succeeds and the insert then fails, we have
 * paid for a generation nobody can see.
 */
export async function attachFalRequest(
  tx: Database,
  jobId: string,
  falRequestId: string,
): Promise<void> {
  await tx
    .update(jobs)
    .set({ falRequestId, status: 'running', startedAt: new Date() })
    .where(eq(jobs.id, jobId))
}

export async function markJobRunning(tx: Database, jobId: string): Promise<void> {
  await tx
    .update(jobs)
    .set({ status: 'running', startedAt: sql`coalesce(${jobs.startedAt}, now())` })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'queued')))
}

export async function completeJob(
  tx: Database,
  jobId: string,
  output: unknown,
  creditsCharged?: string,
): Promise<void> {
  await tx
    .update(jobs)
    .set({
      status: 'completed',
      output,
      creditsCharged: creditsCharged ?? null,
      finishedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
}

export async function failJob(tx: Database, jobId: string, message: string): Promise<void> {
  await tx
    .update(jobs)
    .set({ status: 'failed', error: message.slice(0, 500), finishedAt: new Date() })
    .where(eq(jobs.id, jobId))
}

export async function findJob(tx: Database, jobId: string): Promise<JobRecord | null> {
  const [row] = await tx.select(columns).from(jobs).where(eq(jobs.id, jobId)).limit(1)
  return (row as JobRecord | undefined) ?? null
}

/** Keyset pagination: `before` is the createdAt of the last row already shown. */
export async function listJobs(
  tx: Database,
  options: { limit: number; before?: Date | undefined },
): Promise<JobRecord[]> {
  const where = options.before ? lt(jobs.createdAt, options.before) : undefined
  const rows = await tx
    .select(columns)
    .from(jobs)
    .where(where)
    .orderBy(desc(jobs.createdAt))
    .limit(Math.min(options.limit, 50))
  return rows as JobRecord[]
}

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
    .where(and(inArray(jobs.status, ['queued', 'running']), lt(jobs.createdAt, options.olderThan)))
    .orderBy(jobs.createdAt)
    .limit(Math.min(options.limit, 200))
  return rows as StrandedJob[]
}
