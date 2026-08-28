import { catalogueAgent, cataloguePrompt } from '@genny/agents/catalogue.ts'
import { findAssetsByIds } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { isCatalogued, recordAssetFacts } from '@genny/db/repositories/asset-facts.ts'
import { findJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { falUrlFor } from '@/features/canvas/server/fal-url.ts'
import { runAgent } from '@/features/canvas/server/run-agent.ts'
import { readCredentials } from '@/features/session/fal-key.ts'

/**
 * Works out what one asset is, and files it.
 *
 * Only what someone keeps. Cataloguing costs about half a cent and three
 * seconds, which is nothing against a video and half again on top of the
 * cheapest image model, so it runs when an asset is uploaded, pinned to a
 * project, or reached for on the board. A generated frame nobody looks at twice
 * is never described, and that is the point.
 *
 * Never throws and never blocks what called it. This is a nicety on top of a
 * library that works without it, so a refusal, a rate limit or an empty balance
 * leaves the asset uncatalogued rather than failing an upload.
 */
export async function catalogueAsset(input: {
  actorId: string
  assetId: string
  /** The project's own words, when there is a project. Sharpens what it says. */
  brief?: string | undefined
}): Promise<boolean> {
  const db = appDb(env().DATABASE_URL)

  try {
    // Asked once. Every trigger fires more than once over an asset's life, and
    // the second answer costs the same as the first and says the same thing.
    const already = await withActor(db, input.actorId, (tx) => isCatalogued(tx, input.assetId))
    if (already) return false

    const [asset] = await withActor(db, input.actorId, (tx) => findAssetsByIds(tx, [input.assetId]))
    // RLS scoped that read, so a miss is somebody else's asset or none at all.
    if (!asset || asset.kind !== 'image') return false

    const credentials = await readCredentials().catch(() => null)
    if (!credentials) return false

    const madeBy = asset.jobId
      ? await withActor(db, input.actorId, (tx) => findJob(tx, asset.jobId ?? ''))
      : null

    const url = await withActor(db, input.actorId, (tx) => falUrlFor(tx, credentials, asset))

    const answered = await runAgent({
      agent: catalogueAgent,
      actorId: input.actorId,
      prompt: cataloguePrompt({
        label: asset.label,
        madeBy: madeBy?.prompt.text,
        brief: input.brief,
      }),
      imageUrls: [url],
    })
    if (!answered.ok) return false

    await withActor(db, input.actorId, (tx) =>
      recordAssetFacts(tx, {
        assetId: asset.id,
        ownerId: input.actorId,
        shortName: answered.value.shortName,
        kind: answered.value.kind,
        subject: answered.value.subject,
        palette: answered.value.palette,
        tags: answered.value.tags,
        groupKey: answered.value.groupKey,
        model: catalogueAgent.model,
      }),
    )
    return true
  } catch {
    return false
  }
}
