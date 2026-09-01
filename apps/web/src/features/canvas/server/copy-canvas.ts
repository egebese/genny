'use server'

import { canvasRef } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { insertNode, listNodes } from '@genny/db/repositories/canvas-nodes.ts'
import { createCanvas, findCanvas } from '@genny/db/repositories/canvases.ts'
import { env } from '@genny/env/env.ts'
import { revalidatePath } from 'next/cache'
import { ensureActorId } from '@/features/session/actor.ts'

/**
 * A second board with the same pictures in the same places.
 *
 * The way anybody actually works: a board is a workspace, and trying four
 * directions from one arrangement meant either wrecking the arrangement or
 * rebuilding it by hand. There was no duplicate anywhere, for a canvas or for a
 * project.
 *
 * Copies the finished nodes only. A node still waiting on a generation belongs
 * to a job on the original board, and `(job_id, output_index)` is unique, so a
 * copy of one would either collide or quietly claim the original's result. The
 * jobs are deliberately dropped: this board's history is that it was copied.
 */
export async function copyCanvas(raw: unknown): Promise<{ id: string } | null> {
  const parsed = canvasRef.safeParse(raw)
  if (!parsed.success) return null
  const actorId = await ensureActorId()

  const made = await withActor(appDb(env().DATABASE_URL), actorId, async (tx) => {
    const source = await findCanvas(tx, parsed.data.canvasId)
    if (!source) return null

    const copy = await createCanvas(tx, {
      ownerId: actorId,
      projectId: source.projectId,
      title: nextTitle(source.title),
    })

    for (const node of await listNodes(tx, source.id)) {
      if (!node.assetId) continue
      await insertNode(tx, {
        canvasId: copy.id,
        ownerId: actorId,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        assetId: node.assetId,
      })
    }
    return copy
  })

  if (!made) return null
  revalidatePath('/c')
  return { id: made.id }
}

/** `Storyboard` becomes `Storyboard copy`, and a copy of that becomes `copy 2`. */
function nextTitle(title: string): string {
  const match = title.match(/^(.*) copy(?: (\d+))?$/)
  if (!match?.[1]) return `${title} copy`.slice(0, 120)
  return `${match[1]} copy ${Number(match[2] ?? 1) + 1}`.slice(0, 120)
}
