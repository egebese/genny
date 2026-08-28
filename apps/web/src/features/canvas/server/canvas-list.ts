import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { type CanvasSummary, listCanvases } from '@genny/db/repositories/canvases.ts'
import { listProjects } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { readActorId } from '@/features/session/actor.ts'

export type CanvasCard = {
  id: string
  title: string
  nodeCount: number
  coverUrl: string | null
  updatedAt: string
}

export type ProjectCanvases = {
  id: string
  title: string
  brief: string | null
  canvases: CanvasCard[]
}

/**
 * Every board, under the project it belongs to.
 *
 * Two queries rather than one per project: the number of projects is small and
 * the number of boards is not, so one pass over each beats a query per section.
 */
export async function canvasList(): Promise<ProjectCanvases[]> {
  const actorId = await readActorId()
  if (!actorId) return []

  const db = appDb(env().DATABASE_URL)
  const [projects, canvases] = await Promise.all([
    withActor(db, actorId, (tx) => listProjects(tx)),
    withActor(db, actorId, (tx) => listCanvases(tx, { limit: 100 })),
  ])

  const byProject = new Map<string, CanvasCard[]>()
  for (const canvas of canvases) {
    const list = byProject.get(canvas.projectId)
    if (list) list.push(toCard(canvas))
    else byProject.set(canvas.projectId, [toCard(canvas)])
  }

  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    brief: project.brief,
    canvases: byProject.get(project.id) ?? [],
  }))
}

function toCard(row: CanvasSummary): CanvasCard {
  return {
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
  }
}
