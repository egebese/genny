import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listJobs } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { collectMediaUrls } from '@genny/fal/outputs.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import type { ResultItem } from '@/features/studio/ui/result-card.tsx'
import { ingestedLabels, ingestedUrls } from './outputs.ts'

export const HISTORY_PAGE_SIZE = 24

type Modality = ModelDefinition['modality']

export type HistoryPage = {
  items: ResultItem[]
  /** Cursor for the next page, or null when there is nothing more. */
  nextCursor: string | null
}

/**
 * A page of an actor's generations, newest first.
 *
 * Keyset pagination on createdAt rather than an offset: with an offset, a
 * generation finishing while someone reads page two shifts every row and they see
 * a duplicate.
 */
export async function historyPage(
  actorId: string,
  options: { modality?: Modality | undefined; before?: Date | undefined } = {},
): Promise<HistoryPage> {
  const catalog = await loadCatalog()
  const names = new Map(
    catalog.map((entry) => [entry.definition.endpointId, entry.definition.displayName]),
  )

  // Each studio shows its own work. A video feed full of stills is not history,
  // it is somebody else's page.
  const endpointIds = options.modality
    ? catalog
        .filter((entry) => entry.definition.modality === options.modality)
        .map((entry) => entry.definition.endpointId)
    : undefined

  const jobs = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    listJobs(tx, { limit: HISTORY_PAGE_SIZE + 1, before: options.before, endpointIds }),
  )

  const page = jobs.slice(0, HISTORY_PAGE_SIZE)
  const last = page.at(-1)

  return {
    items: page.map((job) => ({
      jobId: job.id,
      prompt: job.prompt.text,
      // Falls back to the endpoint id only for a model since removed.
      modelName: names.get(job.endpointId) ?? job.endpointId,
      status: job.status,
      urls: job.status === 'completed' ? urlsFor(job.output) : [],
      assetLabels: job.status === 'completed' ? ingestedLabels(job.output) : [],
      error: job.error,
    })),
    nextCursor: jobs.length > HISTORY_PAGE_SIZE && last ? last.createdAt.toISOString() : null,
  }
}

/** Our bucket first; fal's urls only for jobs that predate ingestion, and those expire. */
function urlsFor(output: unknown): string[] {
  const ours = ingestedUrls(output)
  return ours.length > 0 ? ours : collectMediaUrls(output)
}
