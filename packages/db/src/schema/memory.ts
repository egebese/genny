import { index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { users } from './auth.ts'
import { canvases } from './canvas.ts'

/**
 * What a board has turned out to be about, read back from the work on it.
 *
 * Kept as a history rather than one current row. A board that started as
 * packshots and became a campaign said two different true things at two
 * different times, and overwriting the first would leave no way to see that it
 * moved. The newest row is the one that gets used.
 *
 * `node_count_at` is the trigger and the record of it: the reading is taken
 * every ten nodes, and knowing which ten is what stops the same reading being
 * taken twice.
 */
export const canvasMemory = pgTable(
  'canvas_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** How many nodes the board held when this was read. */
    nodeCountAt: integer('node_count_at').notNull(),
    /** `{ summary, subjects, preferences, avoid }`, as the agent answered it. */
    facts: jsonb('facts').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  /*
   * The reference to `canvases` is replaced by a composite `(id, owner_id)` key
   * in the migration: a key check is not subject to RLS, so without the owner
   * in it an actor could file a reading against somebody else's board.
   */
  (t) => [
    index('canvas_memory_canvas').on(t.canvasId, t.createdAt.desc()),
    ownerPolicy('canvas_memory'),
  ],
).enableRLS()
