import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listCanvases } from '@genny/db/repositories/canvases.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import type { CanvasCard } from '@/features/canvas/server/canvas-list.ts'
import { readActorId } from '@/features/session/actor.ts'

export type ProjectView = {
  id: string
  title: string
  brief: string
  palette: string[]
  canvases: CanvasCard[]
}

export async function projectView(projectId: string): Promise<ProjectView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null
  const actorId = await readActorId()
  if (!actorId) return null

  const db = appDb(env().DATABASE_URL)
  // RLS scopes both reads, so somebody else's project is simply not found.
  const project = await withActor(db, actorId, (tx) => findProject(tx, projectId))
  if (!project) return null

  const canvases = await withActor(db, actorId, (tx) => listCanvases(tx, { projectId }))
  return {
    id: project.id,
    title: project.title,
    brief: project.brief ?? '',
    palette: project.palette,
    canvases: canvases.map((row) => ({
      id: row.id,
      title: row.title,
      nodeCount: row.nodeCount,
      coverUrl:
        row.coverAssetId && row.coverLabel && row.coverStorageKey
          ? assetUrl({
              id: row.coverAssetId,
              label: row.coverLabel,
              storageKey: row.coverStorageKey,
            })
          : null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}
