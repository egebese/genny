import { sql } from 'drizzle-orm'
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { users } from './auth.ts'
import { models } from './models.ts'

export const jobStatus = pgEnum('job_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'canceled',
])

/**
 * One generation request. `falRequestId` is unique so a retried submit or a
 * replayed webhook can never create a second job for the same fal request, which
 * is the difference between charging once and charging twice.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => models.endpointId),
    status: jobStatus('status').notNull().default('queued'),
    falRequestId: text('fal_request_id').unique(),
    /** Prompt text and its @mention references, exactly as the user composed it. */
    prompt: jsonb('prompt').notNull(),
    /** The payload actually sent to fal, after reference mapping. */
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    error: text('error'),
    /** Credits held at submit time. Null in byok mode, where nothing is held. */
    creditsHeld: numeric('credits_held', { precision: 14, scale: 4 }),
    /** Credits actually captured once real usage is known. */
    creditsCharged: numeric('credits_charged', { precision: 14, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('jobs_owner_created').on(t.ownerId, t.createdAt.desc()),
    // Partial index: the reconcile sweep only ever asks for unfinished work.
    index('jobs_status_pending')
      .on(t.status, t.createdAt)
      .where(sql`status in ('queued', 'running')`),
    ownerPolicy('jobs'),
  ],
).enableRLS()
