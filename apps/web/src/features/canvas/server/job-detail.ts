'use server'

import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { findJob, type JobStatus, type StoredPrompt } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { redact } from '@genny/env/redact.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { readActorId } from '@/features/session/actor.ts'

export type JobDetail = {
  jobId: string
  endpointId: string
  modelName: string
  status: JobStatus
  prompt: string
  references: StoredPrompt['references']
  /** The payload actually sent, so what is copied is what ran. */
  settings: Record<string, unknown>
  seed: number | null
  falRequestId: string | null
  creditsHeld: string | null
  creditsCharged: string | null
  createdAt: string
  finishedAt: string | null
  error: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Everything about one generation, for the panel that hangs off its node.
 *
 * The payload goes through `redact` before it leaves the server. Nothing
 * key-shaped should be in a model input to begin with, but the whole point of
 * this surface is that it prints what was sent, and a surface that prints
 * something is the wrong place to be confident.
 */
export async function jobDetail(jobId: string): Promise<JobDetail | null> {
  if (typeof jobId !== 'string' || !UUID.test(jobId)) return null

  const actorId = await readActorId()
  if (!actorId) return null

  const db = appDb(env().DATABASE_URL)
  const job = await withActor(db, actorId, (tx) => findJob(tx, jobId))
  if (!job) return null

  const entry = (await loadCatalog()).find((item) => item.definition.endpointId === job.endpointId)
  const prompt = job.prompt as StoredPrompt

  return {
    jobId: job.id,
    endpointId: job.endpointId,
    modelName: entry?.definition.displayName ?? job.endpointId,
    status: job.status,
    prompt: prompt.text,
    references: prompt.references ?? [],
    settings: redact(job.input) as Record<string, unknown>,
    seed: readSeed(job.output) ?? readSeed(job.input),
    falRequestId: job.falRequestId,
    creditsHeld: job.creditsHeld,
    creditsCharged: job.creditsCharged,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    error: job.error,
  }
}

/**
 * The seed is what keeps a face the same across shots, and fal reports it in the
 * output rather than taking it back from the input, so both are worth reading:
 * a seed the user set is in the input, one the model chose is in the output.
 */
function readSeed(source: unknown): number | null {
  if (!source || typeof source !== 'object') return null
  const seed = (source as { seed?: unknown }).seed
  return typeof seed === 'number' && Number.isFinite(seed) ? seed : null
}
