'use server'

import { saveProjectRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { updateProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
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
