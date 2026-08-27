import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listProjects } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { readActorId } from '@/features/session/actor.ts'

export type ProjectCard = {
  id: string
  title: string
  nodeCount: number
  coverUrl: string | null
  updatedAt: string
}

export async function projectList(): Promise<ProjectCard[]> {
  const actorId = await readActorId()
  if (!actorId) return []

  const rows = await withActor(appDb(env().DATABASE_URL), actorId, (tx) => listProjects(tx))
  return rows.map((row) => ({
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
  }))
}
