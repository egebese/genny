import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import {
  completeJob,
  failJob,
  type JobRecord,
  markJobRunning,
} from '@genny/db/repositories/jobs.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { readJobResult, readJobStatus } from '@genny/fal/queue.ts'

export type TrackEvent =
  | { status: 'queued' | 'running'; jobId: string; queuePosition: number | null }
  | { status: 'completed'; jobId: string; urls: string[] }
  | { status: 'failed'; jobId: string; error: string }
  | { status: 'timeout'; jobId: string }

type TrackedJob = JobRecord & { falRequestId: string }

type TrackContext = {
  db: Database
  actorId: string
  job: TrackedJob
  credentials: FalCredentials
}

type TrackOptions = TrackContext & { pollIntervalMs: number; deadline: number }

/**
 * Follows a fal request to its conclusion, writing each outcome to the job row
 * and yielding what the browser should be told.
 *
 * A generator rather than a callback: the route stays a thin adapter between this
 * and an SSE stream, and this stays testable without a Response object.
 */
export async function* trackJob(options: TrackOptions): AsyncGenerator<TrackEvent> {
  let announcedRunning = options.job.status === 'running'

  while (Date.now() < options.deadline) {
    const step = await pollOnce(options, announcedRunning)
    if (step.terminal) {
      yield step.event
      return
    }
    if (step.event.status === 'running') announcedRunning = true
    yield step.event
    await sleep(options.pollIntervalMs)
  }

  // Not a failure: the job may still finish, and the row remains the truth.
  yield { status: 'timeout', jobId: options.job.id }
}

type Step = { terminal: boolean; event: TrackEvent }

async function pollOnce(context: TrackContext, announcedRunning: boolean): Promise<Step> {
  const { job, credentials } = context

  let snapshot: Awaited<ReturnType<typeof readJobStatus>>
  try {
    snapshot = await readJobStatus(credentials, job.endpointId, job.falRequestId)
  } catch (error) {
    return { terminal: true, event: await recordFailure(context, describe(error)) }
  }

  if (snapshot.state === 'completed') return { terminal: true, event: await finish(context) }
  if (snapshot.state === 'failed') {
    return {
      terminal: true,
      event: await recordFailure(context, 'The model could not finish this generation.'),
    }
  }

  if (snapshot.state === 'running' && !announcedRunning) {
    await withActor(context.db, context.actorId, (tx) => markJobRunning(tx, job.id))
  }
  return {
    terminal: false,
    event: { status: snapshot.state, jobId: job.id, queuePosition: snapshot.queuePosition },
  }
}

async function finish(context: TrackContext): Promise<TrackEvent> {
  const { db, actorId, job, credentials } = context
  try {
    const outputs = await readJobResult(credentials, job.endpointId, job.falRequestId)
    await withActor(db, actorId, (tx) => completeJob(tx, job.id, outputs.raw))
    return { status: 'completed', jobId: job.id, urls: outputs.urls }
  } catch (error) {
    return recordFailure(context, describe(error))
  }
}

async function recordFailure(context: TrackContext, message: string): Promise<TrackEvent> {
  await withActor(context.db, context.actorId, (tx) => failJob(tx, context.job.id, message)).catch(
    () => {},
  )
  return { status: 'failed', jobId: context.job.id, error: message }
}

function describe(error: unknown): string {
  return error instanceof FalFailure ? error.userMessage : 'Lost track of this generation.'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
