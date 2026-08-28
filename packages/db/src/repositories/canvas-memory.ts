import { desc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { canvasMemory } from '../schema/memory.ts'

export type MemoryFacts = {
  summary: string
  subjects: string[]
  preferences: string[]
  avoid: string[]
}

export type MemoryRecord = {
  id: string
  canvasId: string
  nodeCountAt: number
  facts: MemoryFacts
  createdAt: Date
}

const columns = {
  id: canvasMemory.id,
  canvasId: canvasMemory.canvasId,
  nodeCountAt: canvasMemory.nodeCountAt,
  facts: canvasMemory.facts,
  createdAt: canvasMemory.createdAt,
}

export async function recordMemory(
  tx: Database,
  input: { canvasId: string; ownerId: string; nodeCountAt: number; facts: MemoryFacts },
): Promise<void> {
  await tx.insert(canvasMemory).values(input)
}

/** The newest reading of one board, which is the one anything should use. */
export async function latestMemory(tx: Database, canvasId: string): Promise<MemoryRecord | null> {
  const [row] = await tx
    .select(columns)
    .from(canvasMemory)
    .where(eq(canvasMemory.canvasId, canvasId))
    .orderBy(desc(canvasMemory.createdAt))
    .limit(1)
  return (row as MemoryRecord | undefined) ?? null
}

/** Every reading, newest first. The project page shows how a board moved. */
export async function memoryHistory(
  tx: Database,
  canvasId: string,
  limit = 10,
): Promise<MemoryRecord[]> {
  const rows = await tx
    .select(columns)
    .from(canvasMemory)
    .where(eq(canvasMemory.canvasId, canvasId))
    .orderBy(desc(canvasMemory.createdAt))
    .limit(Math.min(limit, 50))
  return rows as MemoryRecord[]
}
