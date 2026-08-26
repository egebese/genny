import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { users } from './auth.ts'

export const assetKind = pgEnum('asset_kind', ['image', 'video', 'audio'])
export const assetSource = pgEnum('asset_source', ['upload', 'generation', 'external'])

/**
 * Everything the user can point at with an @mention. fal keeps generated media
 * for about a week, so a generation's output is ingested into our own bucket and
 * `storageKey` always refers to that copy, never to the fal CDN url.
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: assetKind('kind').notNull(),
    /** The @mention handle. Unique per owner so `@hero-shot` is never ambiguous. */
    label: text('label').notNull(),
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key'),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    source: assetSource('source').notNull(),
    jobId: uuid('job_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('assets_owner_label').on(t.ownerId, t.label),
    // Referenced by character_assets as a composite key, so a membership cannot
    // name an asset owned by somebody else.
    unique('assets_id_owner').on(t.id, t.ownerId),
    index('assets_owner_created').on(t.ownerId, t.createdAt.desc()),
    ownerPolicy('assets'),
  ],
).enableRLS()

/**
 * A named bundle of reference images: `@ayse` resolves to every asset attached
 * here. This is what keeps an identity stable across generations without asking
 * the user to re-pick four files every time.
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('characters_owner_label').on(t.ownerId, t.label), ownerPolicy('characters')],
).enableRLS()

export const characterAssets = pgTable(
  'character_assets',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.assetId] }), ownerPolicy('character_assets')],
).enableRLS()

export const charactersRelations = relations(characters, ({ many }) => ({
  members: many(characterAssets),
}))

export const characterAssetsRelations = relations(characterAssets, ({ one }) => ({
  character: one(characters, {
    fields: [characterAssets.characterId],
    references: [characters.id],
  }),
  asset: one(assets, { fields: [characterAssets.assetId], references: [assets.id] }),
}))
