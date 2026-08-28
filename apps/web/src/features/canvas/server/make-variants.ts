'use server'

import { variantAgent, variantPrompt } from '@genny/agents/variants.ts'
import { variantRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { listNodes } from '@genny/db/repositories/canvas-nodes.ts'
import { findJob } from '@genny/db/repositories/jobs.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import { createGeneration } from './create-generation.ts'
import { resolveAttachments } from './resolve-references.ts'
import { runAgent } from './run-agent.ts'
import { editEndpointFor, settingsCarriedTo } from './variant-target.ts'

export type VariantsResult =
  | { ok: true; jobIds: string[]; nodeIds: string[]; changes: string[] }
  | { ok: false; reason: string }

/**
 * Four more of this one, each different in exactly one way.
 *
 * The agent writes the instructions and the ordinary generation path runs them,
 * which is the only arrangement where variants cost what the dock says they
 * cost, reserve their rectangles before submitting, and appear in the ledger
 * like everything else. An agent that submitted to fal itself would be a second
 * way to spend money, with its own bugs.
 */
export async function makeVariants(raw: unknown): Promise<VariantsResult> {
  const parsed = variantRequest.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'That request is not valid.' }
  const request = parsed.data

  const actorId = await ensureActorId()
  const db = appDb(env().DATABASE_URL)

  const project = await withActor(db, actorId, (tx) => findProject(tx, request.projectId))
  if (!project) return { ok: false, reason: 'That canvas is gone.' }

  // RLS scopes the read, so a node on somebody else's board is simply absent.
  const nodes = await withActor(db, actorId, (tx) => listNodes(tx, request.projectId))
  const source = nodes.find((node) => node.id === request.nodeId)
  if (!source?.assetId || source.kind !== 'image') {
    return { ok: false, reason: 'Variants start from a finished image.' }
  }

  const target = await editEndpointFor(source.endpointId)
  if (!target) {
    return {
      ok: false,
      reason: 'That model cannot be given an image, so there is nothing to vary it against.',
    }
  }

  const credentials = await readCredentials().catch(() => null)
  if (!credentials) return { ok: false, reason: 'Add a fal key before asking for this.' }

  /*
   * The same upload the dock does when you attach something. The agent has to
   * see the image, and fal has to be able to fetch it, so this is one trip that
   * serves both: the url goes to the agent now and to the edit model after.
   */
  const [attached] = await resolveAttachments(db, actorId, credentials, [
    { field: target.slot, assetId: source.assetId },
  ])
  if (!attached) return { ok: false, reason: 'That image could not be read.' }

  const job = source.jobId
    ? await withActor(db, actorId, (tx) => findJob(tx, source.jobId ?? ''))
    : null

  const answered = await runAgent({
    agent: variantAgent,
    actorId,
    canvasId: request.projectId,
    prompt: variantPrompt({
      // Its own prompt when we have it, its label when we do not: an uploaded
      // image has no job behind it and is still worth varying.
      originalPrompt: job?.prompt.text ?? source.label ?? 'an image',
      count: request.rects.length,
    }),
    imageUrls: [attached.url],
  })
  if (!answered.ok) return { ok: false, reason: answered.reason }

  const settings = settingsCarriedTo(target.model, job?.input ?? {})
  const jobIds: string[] = []
  const nodeIds: string[] = []
  const changes: string[] = []

  for (const [at, variant] of answered.value.variants.entries()) {
    const rect = request.rects[at]
    if (!rect) break
    const made = await createGeneration({
      projectId: request.projectId,
      modelId: target.model.endpointId,
      prompt: variant.prompt,
      references: [],
      attachments: [{ field: target.slot, assetId: source.assetId }],
      settings,
      node: rect,
    })
    // One refusal does not cancel the rest: three variants that ran are worth
    // more than a clean failure, and the reason is the same for all of them.
    if (!made.ok) {
      return jobIds.length > 0
        ? { ok: true, jobIds, nodeIds, changes }
        : { ok: false, reason: made.reason }
    }
    jobIds.push(made.jobId)
    nodeIds.push(...made.nodeIds)
    changes.push(variant.change)
  }

  return { ok: true, jobIds, nodeIds, changes }
}
