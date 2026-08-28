'use server'

import { pinAssetRequest, saveProjectRequest, unpinAssetRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { pinToProject, unpinFromProject } from '@genny/db/repositories/brand-kit.ts'
import { findProject, updateProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { catalogueAsset } from '@/features/assets/server/catalogue.ts'
import { ensureActorId } from '@/features/session/actor.ts'

/**
 * The project's details, saved together.
 *
 * One action rather than three, because they are one form: the title, what the
 * project is about, and the colours it works in. Scoped by RLS, so a project
 * belonging to somebody else updates no rows rather than being refused.
 */
export async function saveProject(raw: unknown): Promise<{ ok: boolean; reason?: string }> {
  const parsed = saveProjectRequest.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'Those details are not valid.' }
  const { projectId, title, brief, palette } = parsed.data

  const actorId = await ensureActorId()
  await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    updateProject(tx, projectId, { title, brief: brief === '' ? null : brief, palette }),
  )

  revalidatePath('/c')
  revalidatePath(`/p/${projectId}`)
  return { ok: true }
}

/**
 * Pins an asset to the project, or moves one that is already pinned.
 *
 * `(project_id, asset_id)` is the key, so the same photograph cannot be both a
 * product and a reference at once. Changing which is a move, not a second row.
 */
export async function pinAsset(raw: unknown): Promise<boolean> {
  const parsed = pinAssetRequest.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    pinToProject(tx, { ...parsed.data, ownerId: actorId }),
  )
  /*
   * Pinned means kept, and the project's own words are the best context this
   * asset will ever be described with. Only the first pin pays: `catalogueAsset`
   * asks whether the asset already has a description before it asks a model.
   */
  after(async () => {
    const project = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
      findProject(tx, parsed.data.projectId),
    )
    await catalogueAsset({
      actorId,
      assetId: parsed.data.assetId,
      ...(project?.brief ? { brief: project.brief } : {}),
    })
  })

  revalidatePath(`/p/${parsed.data.projectId}`)
  return true
}

export async function unpinAsset(raw: unknown): Promise<boolean> {
  const parsed = unpinAssetRequest.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  const gone = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    unpinFromProject(tx, parsed.data),
  )
  revalidatePath(`/p/${parsed.data.projectId}`)
  return gone
}
