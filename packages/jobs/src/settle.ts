import { ingestOutputs } from '@genny/assets/ingest.ts'
import { publicUrlFor } from '@genny/assets/keys.ts'
import type { Storage } from '@genny/assets/storage.ts'
import type { Billing } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import { completeJob, failJob, type JobRecord } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { readJobResult } from '@genny/fal/queue.ts'

export type TrackEvent =
  | { status: 'queued' | 'running'; jobId: string; queuePosition: number | null }
  | { status: 'completed'; jobId: string; urls: string[]; assetLabels: string[] }
  | { status: 'failed'; jobId: string; error: string }
  | { status: 'timeout'; jobId: string }

type TrackedJob = JobRecord & { falRequestId: string }

export type TrackContext = {
  db: Database
  actorId: string
  job: TrackedJob
  credentials: FalCredentials
  billing: Billing
  storage: Storage
}

export async function finish(context: TrackContext): Promise<TrackEvent> {
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
      storage: context.storage,
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

/**
 * Give the credits back, then mark the row. A generation that failed costs
 * nothing, and releasing first means a crash between the two leaves the money
 * returned rather than stranded.
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
}): Promise<void> {
  if (Number(input.held) > 0) {
    await input.billing.release(input.actorId, input.held).catch(() => {})
  }
  await withActor(input.db, input.actorId, (tx) => failJob(tx, input.jobId, input.message)).catch(
    () => {},
  )
}

export async function recordFailure(context: TrackContext, message: string): Promise<TrackEvent> {
  await releaseAndFail({
    db: context.db,
    actorId: context.actorId,
    jobId: context.job.id,
    held: context.job.creditsHeld ?? '0',
    billing: context.billing,
    message,
  })
  return { status: 'failed', jobId: context.job.id, error: message }
}

export function describe(error: unknown): string {
  return error instanceof FalFailure ? error.userMessage : 'Lost track of this generation.'
}
