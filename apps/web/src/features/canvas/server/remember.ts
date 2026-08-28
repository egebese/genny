import { isDue, memoryAgent, memoryPrompt } from '@genny/agents/memory.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { canvasEvidence } from '@genny/db/repositories/canvas-evidence.ts'
import { latestMemory, recordMemory } from '@genny/db/repositories/canvas-memory.ts'
import { listNodes } from '@genny/db/repositories/canvas-nodes.ts'
import { findCanvas } from '@genny/db/repositories/canvases.ts'
import { findProject } from '@genny/db/repositories/projects.ts'
import { env } from '@genny/env/env.ts'
import { runAgent } from './run-agent.ts'

/**
 * Reads a board back to itself, if it is time.
 *
 * Nobody writes a brief before they start. They type forty prompts, keep six
 * results and abandon the rest, and somewhere in that is a subject, a look and
 * a set of things they keep steering away from. This is where that gets
 * written down, so every agent after it starts from something.
 *
 * Never throws and never blocks. It runs after a generation has already been
 * submitted, and a board whose reading failed is a board, not an error.
 */
export async function rememberIfDue(input: {
  actorId: string
  canvasId: string
}): Promise<boolean> {
  const db = appDb(env().DATABASE_URL)

  try {
    const { count, previous } = await withActor(db, input.actorId, async (tx) => ({
      count: (await listNodes(tx, input.canvasId)).length,
      previous: await latestMemory(tx, input.canvasId),
    }))

    if (!isDue(count, previous?.nodeCountAt ?? null)) return false

    const { evidence, brief } = await withActor(db, input.actorId, async (tx) => {
      const canvas = await findCanvas(tx, input.canvasId)
      const project = canvas ? await findProject(tx, canvas.projectId) : null
      return {
        evidence: await canvasEvidence(tx, input.canvasId),
        brief: project?.brief ?? undefined,
      }
    })
    // Nothing finished yet: ten reserved rectangles and no prompts to read.
    if (evidence.length === 0) return false

    const answered = await runAgent({
      agent: memoryAgent,
      actorId: input.actorId,
      canvasId: input.canvasId,
      prompt: memoryPrompt({
        evidence,
        ...(brief ? { brief } : {}),
        ...(previous ? { previous: previous.facts } : {}),
      }),
    })
    if (!answered.ok) return false

    await withActor(db, input.actorId, (tx) =>
      recordMemory(tx, {
        canvasId: input.canvasId,
        ownerId: input.actorId,
        nodeCountAt: count,
        facts: answered.value,
      }),
    )
    return true
  } catch {
    return false
  }
}
