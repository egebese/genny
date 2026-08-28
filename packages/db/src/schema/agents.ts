import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { users } from './auth.ts'

export const agentKind = pgEnum('agent_kind', ['variants', 'catalogue', 'memory', 'director'])

/**
 * Every time an agent was asked something, and what it cost.
 *
 * Agents spend money without anyone pressing a button that says so, and they
 * spend it in a unit nobody can see: tokens, priced after the fact. A generation
 * leaves a job row, an asset and a rectangle on a board, so it is obvious what
 * happened. An agent leaves a slightly better sentence somewhere.
 *
 * `cost_usd` is what fal reported for the call, not what we charged. The two are
 * deliberately different: we charge a flat price because tokens cannot be
 * counted in advance, and this column is how anyone checks whether that flat
 * price is still the right one.
 */
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: agentKind('kind').notNull(),
    /** The model name passed through to the router, so a change of model is visible here. */
    model: text('model').notNull(),
    /*
     * Not owner-scoped, and not a foreign key. An agent can be asked something
     * outside any canvas, and a canvas deleted afterwards should not take the
     * record of what was spent with it.
     */
    canvasId: uuid('canvas_id'),
    /** What it was asked. Enough to reproduce a bad answer, no more. */
    input: jsonb('input').notNull(),
    /** What came back, before parsing. A refusal is as worth keeping as an answer. */
    output: text('output'),
    /** Set when the answer did not survive its schema. Null on success. */
    error: text('error'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    tokens: numeric('tokens', { precision: 12, scale: 0 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_runs_owner_created').on(t.ownerId, t.createdAt.desc()),
    ownerPolicy('agent_runs'),
  ],
).enableRLS()
