import 'server-only'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listJobs } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { loadCatalog } from '@genny/models/catalog.ts'

export type HistoryEntry = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled'
  /** The model's display name, or its endpoint id when it has left the catalog. */
  model: string
  prompt: string
  error: string | null
  createdAt: Date
}

/**
 * The generations this actor has run, whatever became of them.
 *
 * The board is not a record of what happened. A generation that failed before
 * fal accepted it has its placeholder deleted, so the only trace was a line of
 * error text in the dock that vanished when the dock was closed. Somebody who
 * came back an hour later to ask why nothing appeared had nowhere to look.
 *
 * Both modes, unlike the credit ledger beside it: byok has no credits but it
 * does have failures, and they are the ones worth explaining.
 */
export async function jobHistory(actorId: string, limit = 30): Promise<HistoryEntry[]> {
  const db = appDb(env().DATABASE_URL)
  const [rows, catalog] = await Promise.all([
    withActor(db, actorId, (tx) => listJobs(tx, { limit })),
    loadCatalog(),
  ])
  const names = new Map(
    catalog.map((entry) => [entry.definition.endpointId, entry.definition.displayName]),
  )

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    model: names.get(row.endpointId) ?? row.endpointId,
    prompt: row.prompt.text,
    error: row.error,
    createdAt: row.createdAt,
  }))
}
