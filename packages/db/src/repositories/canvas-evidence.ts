import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { canvasNodes } from '../schema/canvas.ts'
import { jobs } from '../schema/jobs.ts'
import type { StoredPrompt } from './jobs.ts'

export type Evidence = {
  prompt: string
  model: string
  /** True when something this generation produced was later handed to a model. */
  reused: boolean
}

/**
 * What was asked for on one board, and which answers were kept.
 *
 * Reuse is the strongest preference signal there is. A prompt says what someone
 * hoped for; reaching for the result again says they got it. Both ways of
 * reaching count: mentioning it by handle, and pinning it to a named input.
 *
 * Read from the stored prompt rather than from the payload sent to fal. The
 * payload holds the url an attachment was uploaded to, which expires within the
 * week and never matches anything; the id is the durable half.
 *
 * Oldest first, because the interesting shape is how the board moved.
 */
export async function canvasEvidence(
  tx: Database,
  canvasId: string,
  limit = 60,
): Promise<Evidence[]> {
  const rows = await tx
    .select({
      jobId: jobs.id,
      prompt: jobs.prompt,
      model: jobs.endpointId,
      assetId: canvasNodes.assetId,
    })
    .from(canvasNodes)
    .innerJoin(jobs, eq(jobs.id, canvasNodes.jobId))
    .where(and(eq(canvasNodes.canvasId, canvasId), isNotNull(canvasNodes.assetId)))
    .orderBy(asc(jobs.createdAt))
    .limit(Math.min(limit, 200))

  // Every asset any generation on this board reached for. A generation whose
  // own output appears here was kept.
  const reached = new Set<string>()
  for (const row of rows) {
    const stored = row.prompt as StoredPrompt
    for (const reference of stored.references) reached.add(reference.id)
    for (const attachment of stored.attachments ?? []) reached.add(attachment.assetId)
  }

  const seen = new Set<string>()
  const evidence: Evidence[] = []
  for (const row of rows) {
    // One entry per generation, not per output: four images from one prompt are
    // one thing someone asked for.
    if (seen.has(row.jobId)) continue
    seen.add(row.jobId)
    evidence.push({
      prompt: (row.prompt as StoredPrompt).text,
      model: row.model,
      reused: row.assetId !== null && reached.has(row.assetId),
    })
  }
  return evidence
}
