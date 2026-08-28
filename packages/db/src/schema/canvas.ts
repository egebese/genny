import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
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
 * A piece of work, which is usually more than one board.
 *
 * This used to be the board itself, and one campaign meant either cramming
 * every shot onto one canvas or keeping a row of unrelated boards with no
 * indication that three of them belonged together. What actually recurs is a
 * brief: the same product, the same palette, the same voice, explored across
 * several boards.
 *
 * The brief and the palette live here rather than on a canvas because they are
 * the thing that does not change when you open a new board.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }).notNull(),
    /** What this project is, in the owner's own words. Feeds every agent prompt. */
    brief: text('brief'),
    /** Brand colours as `['#rrggbb']`. Not assets, so not in the asset shelf. */
    palette: jsonb('palette').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('projects_owner_updated').on(t.ownerId, t.updatedAt.desc()),
    unique('projects_id_owner').on(t.id, t.ownerId),
    ownerPolicy('projects'),
  ],
).enableRLS()

/**
 * One infinite canvas, inside a project.
 *
 * The viewport is stored with it because reopening somewhere other than where
 * you left off loses the spatial memory that makes a board readable at all.
 */
export const canvases = pgTable(
  'canvases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
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
    index('canvases_project_updated').on(t.projectId, t.updatedAt.desc()),
    index('canvases_owner_updated').on(t.ownerId, t.updatedAt.desc()),
    // Referenced by canvas_nodes as a composite key, so a node cannot land on
    // somebody else's board.
    unique('canvases_id_owner').on(t.id, t.ownerId),
    ownerPolicy('canvases'),
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
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
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
     * Not owner-scoped the way `canvas_id` is: naming a job you do not own puts
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
    index('canvas_nodes_canvas').on(t.canvasId, t.createdAt),
    unique('canvas_nodes_job_output').on(t.jobId, t.outputIndex),
    ownerPolicy('canvas_nodes'),
  ],
).enableRLS()
