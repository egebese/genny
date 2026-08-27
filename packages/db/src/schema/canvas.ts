import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { assets } from './assets.ts'
import { users } from './auth.ts'
import { jobs } from './jobs.ts'

/**
 * One infinite canvas. A project is a reusable workspace rather than a
 * deliverable: the same board gets reopened with a swapped prompt, which is why
 * the viewport is stored with it. Reopening somewhere other than where you left
 * off loses the spatial memory that makes the board readable at all.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }).notNull(),
    /** Pan and zoom, as `{ x, y, zoom }`. */
    viewport: jsonb('viewport').notNull().default({ x: 0, y: 0, zoom: 1 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('projects_owner_updated').on(t.ownerId, t.updatedAt.desc()),
    // Referenced by canvas_nodes as a composite key, so a node cannot land on
    // somebody else's board.
    unique('projects_id_owner').on(t.id, t.ownerId),
    ownerPolicy('projects'),
  ],
).enableRLS()

/**
 * A placed rectangle on a canvas. Created empty the moment a generation is
 * submitted, so the board reserves the space at the right aspect before anything
 * has been rendered, and filled with its asset once the job settles.
 *
 * `(job_id, output_index)` is unique because filling is idempotent by design: a
 * job that produced three images is materialised by whoever notices it finished
 * first, and the browser stream and the webhook both try.
 */
export const canvasNodes = pgTable(
  'canvas_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Canvas coordinates, not screen pixels. The viewport translates. */
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    /**
     * Null for a node placed from an existing asset rather than generated.
     *
     * Not owner-scoped the way `project_id` is: naming a job you do not own puts
     * no row on anyone else's board, and the status join runs under RLS, so the
     * node simply renders as empty. A wasted row, not a leak.
     */
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    /** Which output of that job this node shows. One generation, many siblings. */
    outputIndex: integer('output_index').notNull().default(0),
    /** Null while the generation is still running. */
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('canvas_nodes_project').on(t.projectId, t.createdAt),
    unique('canvas_nodes_job_output').on(t.jobId, t.outputIndex),
    ownerPolicy('canvas_nodes'),
  ],
).enableRLS()
