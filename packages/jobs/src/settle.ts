import { ingestOutputs } from '@genny/assets/ingest.ts'
import type { Storage } from '@genny/assets/storage.ts'
import { assetUrl } from '@genny/assets/urls.ts'
import type { Billing } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import { completeJob, findJob, type JobRecord } from '@genny/db/repositories/jobs.ts'
import { claimJobSettlement } from '@genny/db/repositories/jobs-settlement.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { readJobResult } from '@genny/fal/queue.ts'
import { outputCount } from '@genny/models/aspect.ts'
import { releaseAndFail } from './failure.ts'

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

/** Long enough that no honest settler is still working, short enough to retry. */
const CLAIM_STALE_AFTER_MS = 5 * 60 * 1000

export async function finish(context: TrackContext): Promise<TrackEvent> {
  const { db, actorId, job, credentials, billing } = context

  // Whoever claims it ingests it. Without this, a webhook and a stream that
  // notice the same completion both download the outputs and the user ends up
  // with two copies of one generation.
  const claimed = await withActor(db, actorId, (tx) =>
    claimJobSettlement(tx, job.id, CLAIM_STALE_AFTER_MS),
  )
  if (!claimed) return await report(context)

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
     *
     * `outputCount` rather than reading the field here: the board reserves its
     * rectangles from it and the estimate is quoted from the same number, so a
     * second copy of "how many outputs is this" is a bill that disagrees with the
     * board about what was ordered.
     */
    const expected = outputCount(job.input)
    const produced = Math.max(1, Math.min(outputs.urls.length || expected, expected))
    const heldCredits = job.creditsHeld ?? '0'
    const actual = ((Number(heldCredits) * produced) / expected).toFixed(4)

    await billing.capture({ actorId, held: heldCredits, actual, jobId: job.id })
    await withActor(db, actorId, (tx) => completeJob(tx, job.id, stored, actual))

    const urls =
      ingested.assets.length > 0 ? ingested.assets.map((asset) => assetUrl(asset)) : outputs.urls
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

/**
 * What to say about a job someone else is settling. Terminal once the winner has
 * written its outcome; until then the caller keeps polling, which is what it was
 * doing anyway.
 */
async function report(context: TrackContext): Promise<TrackEvent> {
  const row = await withActor(context.db, context.actorId, (tx) => findJob(tx, context.job.id))

  if (row?.status === 'failed') {
    return {
      status: 'failed',
      jobId: context.job.id,
      error: row.error ?? 'The model could not finish this generation.',
    }
  }
  if (row?.status !== 'completed') {
    return { status: 'running', jobId: context.job.id, queuePosition: null }
  }

  const assets = storedAssets(row.output)
  return {
    status: 'completed',
    jobId: context.job.id,
    urls: assets.map((asset) => assetUrl(asset)),
    assetLabels: assets.map((asset) => asset.label),
  }
}

type StoredAsset = { id: string; label: string; storageKey: string }

function storedAssets(output: unknown): StoredAsset[] {
  const genny = (output as { genny?: { assets?: unknown } } | null)?.genny
  if (!Array.isArray(genny?.assets)) return []
  return genny.assets.filter(
    (asset): asset is StoredAsset =>
      typeof (asset as { id?: unknown }).id === 'string' &&
      typeof (asset as { label?: unknown }).label === 'string' &&
      typeof (asset as { storageKey?: unknown }).storageKey === 'string',
  )
}
