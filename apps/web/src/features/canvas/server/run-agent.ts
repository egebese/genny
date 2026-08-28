import { parseAgentOutput } from '@genny/agents/parse.ts'
import type { AgentDefinition } from '@genny/agents/registry.ts'
import { createBilling } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { findActor } from '@genny/db/repositories/actors.ts'
import { recordAgentRun } from '@genny/db/repositories/agent-runs.ts'
import { env } from '@genny/env/env.ts'
import { FalFailure } from '@genny/fal/errors.ts'
import { runText } from '@genny/fal/text.ts'
import { creditsFor } from '@genny/models/credits.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { readCredentials } from '@/features/session/fal-key.ts'

export type AgentOutcome<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * The one way an agent is asked anything.
 *
 * Everything that makes an agent call different from a generation lives here:
 * it answers inline rather than through the queue, it is priced flat rather
 * than by output, and it leaves a row rather than a rectangle. Everything that
 * makes it the same, credentials and the credit ledger and the rate limiter,
 * goes through the parts that already exist.
 *
 * The hold happens before the call and is captured at the same number, because
 * the price is flat. There is nothing to settle: tokens are only counted once
 * the answer exists, and by then the money question is already decided.
 */
export async function runAgent<T>(input: {
  agent: AgentDefinition<T>
  actorId: string
  prompt: string
  imageUrls?: readonly string[] | undefined
  canvasId?: string | undefined
}): Promise<AgentOutcome<T>> {
  const { agent, actorId } = input
  const db = appDb(env().DATABASE_URL)

  const actor = await findActor(
    ownerDb(env().DATABASE_MIGRATION_URL ?? env().DATABASE_URL),
    actorId,
  )
  if (!actor) return { ok: false, reason: 'Sign in again to use this.' }

  const verdict = await createPostgresLimiter(db).check(ruleFor('agent', actorId))
  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil((verdict.resetAt.getTime() - Date.now()) / 60_000))
    return {
      ok: false,
      reason: `That is a lot of thinking at once. Try again in ${minutes} minutes.`,
    }
  }

  const credentials = await readCredentials().catch(() => null)
  if (!credentials) return { ok: false, reason: 'Add a fal key before asking for this.' }

  /*
   * Chosen here rather than by the database, so the ledger entry and the record
   * of what was asked share an id. A capture keyed on a throwaway uuid charges
   * correctly and answers no question anyone later asks.
   */
  const runId = crypto.randomUUID()
  const billing = createBilling(env().GENNY_MODE, db)
  const price = String(creditsFor(agent, { units: 1 }, env().CREDIT_PER_USD))
  const held = await billing.hold(actorId, price)
  if (!held.ok) return { ok: false, reason: held.reason }

  const record = (fields: { output?: string; error?: string; cost?: number; tokens?: number }) =>
    withActor(db, actorId, (tx) =>
      recordAgentRun(tx, {
        id: runId,
        ownerId: actorId,
        kind: agent.id,
        model: agent.model,
        canvasId: input.canvasId ?? null,
        input: { prompt: input.prompt, images: input.imageUrls?.length ?? 0 },
        output: fields.output ?? null,
        error: fields.error ?? null,
        costUsd: fields.cost ?? null,
        tokens: fields.tokens ?? null,
      }),
    )

  let answered: Awaited<ReturnType<typeof runText>>
  try {
    answered = await runText(credentials, {
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      prompt: input.prompt,
      temperature: agent.temperature,
      ...(input.imageUrls ? { imageUrls: input.imageUrls } : {}),
    })
  } catch (error) {
    // Nothing was produced, so nothing is owed. Same direction as a generation
    // that never reached fal.
    await billing.release(actorId, held.held)
    const reason = error instanceof FalFailure ? error.userMessage : 'That did not go through.'
    await record({ error: reason })
    return { ok: false, reason }
  }

  const parsed = parseAgentOutput(answered.output, agent.schema)
  /*
   * A malformed answer is still a charge. The tokens were spent, and refunding
   * them would make a badly worded system prompt free to keep, which is the
   * wrong incentive on our side of the line.
   */
  await billing.capture({ actorId, held: held.held, actual: held.held, jobId: runId })
  await record({
    output: answered.output.slice(0, 8000),
    cost: answered.costUsd,
    tokens: answered.tokens,
    ...(parsed.ok ? {} : { error: parsed.reason }),
  })

  return parsed.ok
    ? { ok: true, value: parsed.value }
    : { ok: false, reason: 'The answer came back in a shape we could not use. Try again.' }
}
