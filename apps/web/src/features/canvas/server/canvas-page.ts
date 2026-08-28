import { assetUrl } from '@genny/assets/urls.ts'
import { createBilling } from '@genny/billing/provider.ts'
import { canvasRef } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listBrandKit } from '@genny/db/repositories/brand-kit.ts'
import { listNodes } from '@genny/db/repositories/canvas-nodes.ts'
import type { Viewport } from '@genny/db/repositories/canvases.ts'
import { findCanvas } from '@genny/db/repositories/canvases.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import { listMentionablesFor } from '@/features/assets/server/list.ts'
import { readActorId } from '@/features/session/actor.ts'
import { hasUsableCredentials } from '@/features/session/fal-key.ts'
import { toPickable } from '../model-list.ts'
import { type CanvasNodeView, toNodeView } from '../node-view.ts'
import { materializePending } from './materialize.ts'

/** One pinned item, as the shelf draws it. The storage key stays on the server. */
export type BrandItemView = {
  assetId: string
  role: 'logo' | 'product' | 'reference'
  label: string
  url: string
  kind: 'image' | 'video' | 'audio'
}

export type CanvasPage = {
  canvasId: string
  projectId: string
  projectTitle: string
  /** The project's own material, pinned to the board on every canvas of it. */
  brandKit: BrandItemView[]
  palette: string[]
  title: string
  viewport: Viewport
  nodes: CanvasNodeView[]
  models: ReturnType<typeof toPickable>[]
  mentionables: Awaited<ReturnType<typeof listMentionablesFor>>
  credits: { balance: string; holdBalance: string; perUsd: number } | null
  hasCredentials: boolean
}

/**
 * Everything one board needs, in one load.
 *
 * The catalog is no longer split by modality: there is one input box now, and a
 * board that holds a still, the clip animated from it and its voiceover is the
 * whole point of dropping the three studios.
 */
export async function canvasPage(canvasId: string): Promise<CanvasPage | null> {
  // A path segment is whatever someone typed. Postgres raises on a uuid cast it
  // cannot make, which turns a wrong url into a 500 rather than the 404 it is.
  if (!canvasRef.safeParse({ canvasId }).success) return null

  const actorId = await readActorId()
  if (!actorId) return null

  const db = appDb(env().DATABASE_URL)
  const board = await withActor(db, actorId, async (tx) => {
    const canvas = await findCanvas(tx, canvasId)
    if (!canvas) return null
    // Jobs that finished while this tab was closed. The stream cannot have
    // caught them and the webhook does not know about boards.
    await materializePending(tx, { canvasId, ownerId: actorId })
    return {
      canvas,
      nodes: await listNodes(tx, canvasId),
      project: await findProject(tx, canvas.projectId),
      kit: await listBrandKit(tx, canvas.projectId),
    }
  })
  if (!board) return null

  const billing = createBilling(env().GENNY_MODE, db)
  const [catalog, mentionables, balance, ready] = await Promise.all([
    loadCatalog(),
    listMentionablesFor(actorId),
    billing.balance(actorId),
    hasUsableCredentials(),
  ])

  return {
    canvasId,
    projectId: board.canvas.projectId,
    projectTitle: board.project?.title ?? 'Untitled project',
    brandKit: board.kit.map((item) => ({
      assetId: item.assetId,
      role: item.role,
      label: item.label,
      url: assetUrl({ id: item.assetId, label: item.label, storageKey: item.storageKey }),
      kind: item.kind,
    })),
    palette: board.project?.palette ?? [],
    title: board.canvas.title,
    viewport: board.canvas.viewport,
    nodes: board.nodes.map(toNodeView),
    models: catalog.map((entry) => toPickable(entry.definition)),
    mentionables,
    credits: balance ? { ...balance, perUsd: env().CREDIT_PER_USD } : null,
    hasCredentials: ready,
  }
}
