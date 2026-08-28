'use server'

import { directorAgent, directorPrompt } from '@genny/agents/director.ts'
import { directorRequest } from '@genny/canvas/requests.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { latestMemory } from '@genny/db/repositories/canvas-memory.ts'
import { listNodes } from '@genny/db/repositories/canvas-nodes.ts'
import { findCanvas } from '@genny/db/repositories/canvases.ts'
import { findJob } from '@genny/db/repositories/jobs.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { uploadReference } from '@genny/fal/upload.ts'
import { ensureActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import { storage } from '@/features/storage.ts'
import { runAgent } from './run-agent.ts'

export type DirectorReply =
  | { ok: true; reply: string; shots: { prompt: string; title: string }[] }
  | { ok: false; reason: string }

/** How many results it is shown. Each image is about 1100 tokens of context. */
const LOOKING_AT = 4

/**
 * One turn with the director.
 *
 * It is told what the project is, what the boards have turned out to be about,
 * and what is on this one, then shown a few of the results. Everything it knows
 * is something the studio already recorded: nothing here asks the person to
 * repeat themselves, which is the only reason it is worth asking at all.
 *
 * It answers, and sometimes proposes shots. It never runs them. A generation
 * still goes through the dock, so it costs what the dock says and reserves its
 * rectangle before submitting, like everything else on the board.
 */
export async function askDirector(raw: unknown): Promise<DirectorReply> {
  const parsed = directorRequest.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'That is not a question I can take.' }
  const { canvasId, question, selected } = parsed.data

  const actorId = await ensureActorId()
  const db = appDb(env().DATABASE_URL)

  const board = await withActor(db, actorId, async (tx) => {
    const canvas = await findCanvas(tx, canvasId)
    if (!canvas) return null
    return {
      nodes: await listNodes(tx, canvasId),
      memory: await latestMemory(tx, canvasId),
      project: await findProject(tx, canvas.projectId),
    }
  })
  if (!board) return { ok: false, reason: 'That canvas is gone.' }

  const credentials = await readCredentials().catch(() => null)
  if (!credentials) return { ok: false, reason: 'Add a fal key before asking for this.' }

  /*
   * What it looks at: the selection when there is one, otherwise the newest
   * few. Selecting three shots and asking "what is wrong with these" has to
   * mean those three, and an unasked-for critique of the whole board is the
   * answer nobody wanted.
   */
  const ready = board.nodes.filter((node) => node.assetId && node.kind === 'image' && node.label)
  const chosen = selected.length > 0 ? ready.filter((node) => selected.includes(node.id)) : ready
  const looking = chosen.slice(-LOOKING_AT)

  const urls: string[] = []
  for (const node of looking) {
    if (!node.assetId || !node.label || !node.storageKey) continue
    const bytes = await storage()
      .get(node.storageKey)
      .catch(() => null)
    if (!bytes) continue
    urls.push(await uploadReference(credentials, bytes, 'image/png'))
  }

  const prompts = await withActor(db, actorId, async (tx) => {
    const seen = new Set<string>()
    const found: string[] = []
    for (const node of board.nodes) {
      if (!node.jobId || seen.has(node.jobId)) continue
      seen.add(node.jobId)
      const job = await findJob(tx, node.jobId)
      if (job) found.push(job.prompt.text)
    }
    return found.slice(-20)
  })

  const answered = await runAgent({
    agent: directorAgent,
    actorId,
    canvasId,
    prompt: directorPrompt({
      question,
      onBoard: prompts,
      looking: urls.length,
      ...(board.project?.brief ? { brief: board.project.brief } : {}),
      ...(board.memory ? { memory: board.memory.facts } : {}),
    }),
    imageUrls: urls,
  })
  if (!answered.ok) return { ok: false, reason: answered.reason }

  return { ok: true, reply: answered.value.reply, shots: answered.value.shots }
}
