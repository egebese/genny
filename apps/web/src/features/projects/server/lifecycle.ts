'use server'

import { newProjectRequest, projectRef } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { createProject, deleteProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
import { ensureActorId } from '@/features/session/actor.ts'

/**
 * Making and removing a project.
 *
 * `createProject` and `deleteProject` were both written when the hierarchy
 * landed and neither was ever called from anywhere. Projects could only come
 * into existence implicitly, through `defaultProject` on the first canvas, so
 * there was exactly one of them per person and no way to make a second.
 */
export async function startProject(raw: unknown): Promise<{ id: string } | null> {
  const parsed = newProjectRequest.safeParse(raw)
  if (!parsed.success) return null
  const actorId = await ensureActorId()

  const made = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    createProject(tx, { ownerId: actorId, title: parsed.data.title }),
  )
  revalidatePath('/c')
  return { id: made.id }
}

/**
 * Deleting one takes its canvases with it, by cascade. That is the honest
 * behaviour and the confirmation says so, rather than orphaning boards into a
 * list with no heading.
 */
export async function discardProject(raw: unknown): Promise<boolean> {
  const parsed = projectRef.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()

  const gone = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    deleteProject(tx, parsed.data.projectId),
  )
  revalidatePath('/c')
  return gone
}
