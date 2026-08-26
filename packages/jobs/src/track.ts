import { withActor } from '@genny/db/actor.ts'
import { markJobRunning } from '@genny/db/repositories/jobs.ts'
import { readJobStatus } from '@genny/fal/queue.ts'
import { describe, finish, recordFailure, type TrackContext, type TrackEvent } from './settle.ts'

export type Step = { terminal: boolean; event: TrackEvent }

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
    const step = await settleOnce(options, announcedRunning)
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

/**
 * One poll and whatever it settles. Exported because the reconcile sweep needs
 * exactly this and must not grow its own copy of the money handling.
 */
export async function settleOnce(context: TrackContext, announcedRunning = false): Promise<Step> {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
