'use server'

import {
  createProjectRequest,
  materializeRequest,
  moveNodeRequest,
  nodeRef,
  projectRef,
  renameProjectRequest,
  saveViewportRequest,
} from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import {
  deleteNode,
  listNodes,
  moveNode,
  type NodeRecord,
} from '@genny/db/repositories/canvas-nodes.ts'
import {
  createProject,
  deleteProject,
  findProject,
  renameProject,
  saveViewport,
  touchProject,
} from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
import { ensureActorId } from '@/features/session/actor.ts'
import { materializeJob } from './materialize.ts'

const db = () => appDb(env().DATABASE_URL)

/**
 * Every action below is scoped by RLS rather than by an ownership check: a
 * project belonging to somebody else is not found, and a node update matches no
 * row. The failure direction is the correct one, which is why the ids arriving
 * from the browser are validated for shape only.
 */
export async function newProject(raw: unknown): Promise<{ id: string } | null> {
  const parsed = createProjectRequest.safeParse(raw)
  if (!parsed.success) return null
  const actorId = await ensureActorId()
  const project = await withActor(db(), actorId, (tx) =>
    createProject(tx, { ownerId: actorId, title: parsed.data.title }),
  )
  revalidatePath('/c')
  return { id: project.id }
}

export async function retitleProject(raw: unknown): Promise<boolean> {
  const parsed = renameProjectRequest.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  await withActor(db(), actorId, (tx) =>
    renameProject(tx, parsed.data.projectId, parsed.data.title),
  )
  revalidatePath('/c')
  return true
}

export async function discardProject(raw: unknown): Promise<boolean> {
  const parsed = projectRef.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  const gone = await withActor(db(), actorId, (tx) => deleteProject(tx, parsed.data.projectId))
  revalidatePath('/c')
  return gone
}

/**
 * Panning writes constantly, so this deliberately stays the cheapest action
 * there is: one update, no revalidation, nothing else touched.
 */
export async function persistViewport(raw: unknown): Promise<void> {
  const parsed = saveViewportRequest.safeParse(raw)
  if (!parsed.success) return
  const { projectId, ...viewport } = parsed.data
  const actorId = await ensureActorId()
  await withActor(db(), actorId, (tx) => saveViewport(tx, projectId, viewport))
}

export async function repositionNode(raw: unknown): Promise<void> {
  const parsed = moveNodeRequest.safeParse(raw)
  if (!parsed.success) return
  const { projectId, nodeId, ...position } = parsed.data
  const actorId = await ensureActorId()
  await withActor(db(), actorId, async (tx) => {
    await moveNode(tx, nodeId, position)
    await touchProject(tx, projectId)
  })
}

export async function removeNode(raw: unknown): Promise<boolean> {
  const parsed = nodeRef.safeParse(raw)
  if (!parsed.success) return false
  const actorId = await ensureActorId()
  return withActor(db(), actorId, async (tx) => {
    const gone = await deleteNode(tx, parsed.data.nodeId)
    if (gone) await touchProject(tx, parsed.data.projectId)
    return gone
  })
}

/** Returns the whole board rather than a diff: it is one query and never wrong. */
export async function settleJobOnCanvas(raw: unknown): Promise<NodeRecord[]> {
  const parsed = materializeRequest.safeParse(raw)
  if (!parsed.success) return []
  const actorId = await ensureActorId()
  return withActor(db(), actorId, async (tx) => {
    if (!(await findProject(tx, parsed.data.projectId))) return []
    await materializeJob(tx, {
      projectId: parsed.data.projectId,
      ownerId: actorId,
      jobId: parsed.data.jobId,
    })
    return listNodes(tx, parsed.data.projectId)
  })
}
