import { desc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { agentRuns } from '../schema/agents.ts'

export type AgentKind = 'variants' | 'catalogue' | 'memory' | 'director'

export type NewAgentRun = {
  /** Chosen by the caller, so the credit ledger can point at this row. */
  id: string
  ownerId: string
  kind: AgentKind
  model: string
  canvasId?: string | null | undefined
  input: Record<string, unknown>
  output?: string | null | undefined
  error?: string | null | undefined
  costUsd?: number | null | undefined
  tokens?: number | null | undefined
}

export type AgentRunRecord = {
  id: string
  kind: AgentKind
  model: string
  costUsd: string | null
  tokens: string | null
  error: string | null
  createdAt: Date
}

/**
 * Records a call whether it worked or not.
 *
 * A failed agent call still cost money and still took two seconds of someone's
 * attention, so leaving only the successes would make the ledger read better
 * than the product behaves.
 */
export async function recordAgentRun(tx: Database, input: NewAgentRun): Promise<void> {
  await tx.insert(agentRuns).values({
    id: input.id,
    ownerId: input.ownerId,
    kind: input.kind,
    model: input.model,
    canvasId: input.canvasId ?? null,
    input: input.input,
    output: input.output ?? null,
    error: input.error ?? null,
    costUsd: input.costUsd === undefined || input.costUsd === null ? null : String(input.costUsd),
    tokens: input.tokens === undefined || input.tokens === null ? null : String(input.tokens),
  })
}

export async function listAgentRuns(tx: Database, limit = 50): Promise<AgentRunRecord[]> {
  return await tx
    .select({
      id: agentRuns.id,
      kind: agentRuns.kind,
      model: agentRuns.model,
      costUsd: agentRuns.costUsd,
      tokens: agentRuns.tokens,
      error: agentRuns.error,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .orderBy(desc(agentRuns.createdAt))
    .limit(Math.min(limit, 200))
}

export async function agentRunsFor(tx: Database, canvasId: string): Promise<AgentRunRecord[]> {
  return await tx
    .select({
      id: agentRuns.id,
      kind: agentRuns.kind,
      model: agentRuns.model,
      costUsd: agentRuns.costUsd,
      tokens: agentRuns.tokens,
      error: agentRuns.error,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .where(eq(agentRuns.canvasId, canvasId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(50)
}
