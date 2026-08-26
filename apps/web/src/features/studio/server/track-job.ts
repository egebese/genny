import { ingestOutputs } from '@genny/assets/ingest.ts'
import { publicUrlFor } from '@genny/assets/keys.ts'
import type { Billing } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import {
  completeJob,
  failJob,
  type JobRecord,
  markJobRunning,
} from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { readJobResult, readJobStatus } from '@genny/fal/queue.ts'
import { storage } from './storage.ts'

export type TrackEvent =
  | { status: 'queued' | 'running'; jobId: string; queuePosition: number | null }
  | { status: 'completed'; jobId: string; urls: string[]; assetLabels: string[] }
  | { status: 'failed'; jobId: string; error: string }
  | { status: 'timeout'; jobId: string }

type TrackedJob = JobRecord & { falRequestId: string }

type TrackContext = {
  db: Database
  actorId: string
  job: TrackedJob
  credentials: FalCredentials
  billing: Billing
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
  const { db, actorId, job, credentials, billing } = context
  try {
    const outputs = await readJobResult(credentials, job.endpointId, job.falRequestId)

    /*
     * Copy the media into our own bucket before finishing. fal keeps it for about
     * a week, so a gallery pointing at fal urls quietly empties itself.
     *
     * If ingestion fails we still complete the job and hand back fal's urls: a
     * result the user can see and download beats a failure over storage they did
     * not ask about. The failure is recorded on the row.
     */
    const ingested = await ingestOutputs({
      db,
      storage: storage(),
      ownerId: actorId,
      jobId: job.id,
      urls: outputs.urls,
      labelHint: job.prompt.text,
    })

    const stored = {
      ...(outputs.raw as Record<string, unknown>),
      genny: {
        assets: ingested.assets.map((asset) => ({
          id: asset.id,
          label: asset.label,
          storageKey: asset.storageKey,
        })),
        ingestFailures: ingested.failures,
      },
    }
    /*
     * Settle at what the run actually produced. A model asked for four images and
     * returning three has cost three, so the hold is captured in proportion and
     * the rest goes back. Without this, the estimate silently becomes the price.
     */
    const expected = Number(job.input.num_images ?? 1) || 1
    const produced = Math.max(1, Math.min(outputs.urls.length || expected, expected))
    const heldCredits = job.creditsHeld ?? '0'
    const actual = ((Number(heldCredits) * produced) / expected).toFixed(4)

    await billing.capture({ actorId, held: heldCredits, actual, jobId: job.id })
    await withActor(db, actorId, (tx) => completeJob(tx, job.id, stored, actual))

    const urls =
      ingested.assets.length > 0
        ? ingested.assets.map((asset) => publicUrlFor(env().S3_PUBLIC_URL, asset.storageKey))
        : outputs.urls
    return {
      status: 'completed',
      jobId: job.id,
      urls,
      // Empty when ingestion failed: the urls are fal's and expire, so there is
      // nothing durable to mention.
      assetLabels: ingested.assets.map((asset) => asset.label),
    }
  } catch (error) {
    return recordFailure(context, describe(error))
  }
}

async function recordFailure(context: TrackContext, message: string): Promise<TrackEvent> {
  // A generation that failed costs nothing, so the hold goes back before the row
  // is marked. Releasing first means a crash here leaves credits returned rather
  // than stranded.
  await context.billing.release(context.actorId, context.job.creditsHeld ?? '0').catch(() => {})
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
