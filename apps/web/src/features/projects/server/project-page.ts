import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { type BrandRole, listBrandKit } from '@genny/db/repositories/brand-kit.ts'
import { latestMemory, type MemoryFacts } from '@genny/db/repositories/canvas-memory.ts'
import { listCanvases } from '@genny/db/repositories/canvases.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import type { CanvasCard } from '@/features/canvas/server/canvas-list.ts'
import { readActorId } from '@/features/session/actor.ts'

export type PinnedAsset = {
  assetId: string
  role: BrandRole
  label: string
  url: string
  kind: 'image' | 'video' | 'audio'
}

export type ProjectView = {
  id: string
  title: string
  brief: string
  palette: string[]
  /** The project's own material: the logo, the products, the shots to work from. */
  pinned: PinnedAsset[]
  canvases: CanvasCard[]
  /**
   * What each board turned out to be about, read back from the work on it.
   *
   * Shown rather than merged into the brief. The brief is the owner's sentence
   * and this is an observation, and a system that quietly rewrites the first
   * with the second is one nobody can correct.
   */
  observed: { canvasId: string; title: string; facts: MemoryFacts }[]
}

export async function projectView(projectId: string): Promise<ProjectView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null
  const actorId = await readActorId()
  if (!actorId) return null

  const db = appDb(env().DATABASE_URL)
  // RLS scopes both reads, so somebody else's project is simply not found.
  const project = await withActor(db, actorId, (tx) => findProject(tx, projectId))
  if (!project) return null

  const [canvases, kit] = await Promise.all([
    withActor(db, actorId, (tx) => listCanvases(tx, { projectId })),
    withActor(db, actorId, (tx) => listBrandKit(tx, projectId)),
  ])

  const readings = await withActor(db, actorId, async (tx) =>
    Promise.all(
      canvases.map(async (canvas) => [canvas, await latestMemory(tx, canvas.id)] as const),
    ),
  )

  return {
    id: project.id,
    title: project.title,
    brief: project.brief ?? '',
    palette: project.palette,
    pinned: kit.map((item) => ({
      assetId: item.assetId,
      role: item.role,
      label: item.label,
      url: assetUrl({ id: item.assetId, label: item.label, storageKey: item.storageKey }),
      kind: item.kind,
    })),
    observed: readings
      .filter(([, memory]) => memory !== null)
      .map(([canvas, memory]) => ({
        canvasId: canvas.id,
        title: canvas.title,
        facts: (memory as NonNullable<typeof memory>).facts,
      })),
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
