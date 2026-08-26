import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listJobs } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { collectMediaUrls } from '@genny/fal/outputs.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import type { Metadata } from 'next'
import { listAssetsFor } from '@/features/assets/server/list.ts'
import { readActorId } from '@/features/session/actor.ts'
import { hasUsableCredentials } from '@/features/session/fal-key.ts'
import { toPickable } from '@/features/studio/model-list.ts'
import { ingestedUrls } from '@/features/studio/server/outputs.ts'
import type { ResultItem } from '@/features/studio/ui/result-card.tsx'
import { Studio } from '@/features/studio/ui/studio.tsx'

export const metadata: Metadata = { title: 'Image' }

/**
 * Loads what the studio needs on the server: the catalog, whether a key is
 * usable, and the actor's recent jobs. History comes from the job rows, so a
 * refresh mid-generation resumes rather than losing the work.
 */
export default async function ImageStudioPage() {
  const models = (await loadCatalog())
    .filter((entry) => entry.definition.modality === 'image')
    .map((entry) => toPickable(entry.definition))

  const names = new Map(models.map((model) => [model.endpointId, model.displayName]))
  const actorId = await readActorId()
  const [ready, history, assets] = await Promise.all([
    hasUsableCredentials(),
    recentJobs(names),
    actorId ? listAssetsFor(actorId, { kind: 'image' }) : Promise.resolve([]),
  ])

  return <Studio models={models} history={history} assets={assets} hasCredentials={ready} />
}

async function recentJobs(names: Map<string, string>): Promise<ResultItem[]> {
  const actorId = await readActorId()
  if (!actorId) return []

  const jobs = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    listJobs(tx, { limit: 24 }),
  )

  return jobs.map((job) => ({
    jobId: job.id,
    prompt: job.prompt.text,
    // Fall back to the endpoint id only for a model since removed from the catalog.
    modelName: names.get(job.endpointId) ?? job.endpointId,
    status: job.status,
    // Our bucket first; fal's urls only for jobs that predate ingestion, and
    // those expire.
    urls:
      job.status === 'completed'
        ? ingestedUrls(job.output).length > 0
          ? ingestedUrls(job.output)
          : collectMediaUrls(job.output)
        : [],
    error: job.error,
  }))
}
