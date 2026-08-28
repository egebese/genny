import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { assets } from './assets.ts'
import { users } from './auth.ts'

export const assetKindGuess = pgEnum('asset_kind_guess', [
  'product',
  'character',
  'logo',
  'scene',
  'texture',
  'diagram',
  'other',
])

/**
 * What an asset is, as opposed to where it came from.
 *
 * A separate table rather than columns on `assets`, for two reasons. Most
 * assets never get catalogued, because it costs money and only what someone
 * keeps is worth the half cent; nullable columns on the main table would make
 * "not yet asked" and "asked, and it had no tags" the same row. And this is a
 * model's opinion, recorded with the model that held it, so a better model next
 * year can be told apart from the answers this one gave.
 */
export const assetFacts = pgTable(
  'asset_facts',
  {
    assetId: uuid('asset_id')
      .primaryKey()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shortName: text('short_name').notNull(),
    kind: assetKindGuess('kind').notNull(),
    subject: text('subject').notNull(),
    /** The colours in the asset itself, not the project's palette. */
    palette: jsonb('palette').notNull().default([]),
    tags: jsonb('tags').notNull().default([]),
    /** Names the thing depicted, so four shots of one product share it. */
    groupKey: text('group_key').notNull(),
    /** Which model said so, so a change of model is visible in the data. */
    model: text('model').notNull(),
    analysedAt: timestamp('analysed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  /*
   * The reference to `assets` is replaced by a composite `(id, owner_id)` key
   * in the migration: a key check is not subject to RLS, so without the owner
   * in it an actor could file a description against somebody else's asset.
   */
  (t) => [index('asset_facts_owner_group').on(t.ownerId, t.groupKey), ownerPolicy('asset_facts')],
).enableRLS()
