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
    /*
     * The @mention handle.
     *
     * Unique per owner here, but that is not the whole story and the comment
     * that used to sit here claimed it was: `asset_groups.label` has its own
     * separate unique, so nothing in the database stops one name meaning both.
     * The dock resolves a prompt through a single map keyed by label, so when
     * that happened the group silently lost. The two write paths deduplicate
     * across both tables; the database cannot.
     */
    label: text('label').notNull(),
    storageKey: text('storage_key').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    source: assetSource('source').notNull(),
    /*
     * Where this asset lives on fal's CDN, if it has been sent there.
     *
     * fal's own guidance: upload once, reuse the url across as many inference
     * requests as you need. We were uploading the same bytes again for every
     * generation that referenced them, so four variants of one photograph meant
     * five uploads of the same photograph.
     *
     * With its date, because the url does not live forever and nothing tells us
     * when it dies. Past a conservative age it is treated as gone.
     */
    falUrl: text('fal_url'),
    falUrlAt: timestamp('fal_url_at', { withTimezone: true }),
    jobId: uuid('job_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /*
     * Deleted, but still referenced.
     *
     * A canvas node points at the asset it drew, so a real DELETE cascades
     * those nodes off somebody's board with no warning and no way back. The
     * row stays as a tombstone and the bytes in the bucket do not, so the
     * board can say the media is gone rather than silently losing the frame.
     * Every read path filters on this.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('assets_owner_label').on(t.ownerId, t.label),
    // Referenced as a composite key by group members and by canvas nodes, so
    // neither can name an asset owned by somebody else. A key check is not
    // subject to RLS, which is why the second column is load-bearing.
    unique('assets_id_owner').on(t.id, t.ownerId),
    index('assets_owner_created').on(t.ownerId, t.createdAt.desc()),
    ownerPolicy('assets'),
  ],
).enableRLS()

/**
 * What kind of thing a group stands for.
 *
 * It used to be only assetGroups, and a table called `assetGroups` holding four
 * angles of a hoodie is a table nobody can read. The kind decides how the
 * library files it and what an agent is told the set is, which is why it is a
 * closed list rather than a label.
 */
export const groupKind = pgEnum('group_kind', ['character', 'product', 'style', 'set'])

/**
 * A named bundle of assets: `@ayse` resolves to every asset attached here, and
 * so does `@offwhite-hoodie`. This is what keeps a subject stable across
 * generations without asking anyone to re-pick four files every time.
 */
export const assetGroups = pgTable(
  'asset_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    kind: groupKind('kind').notNull().default('character'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('asset_groups_owner_label').on(t.ownerId, t.label),
    // Referenced as a composite key, so a member cannot join somebody else's group.
    unique('asset_groups_id_owner').on(t.id, t.ownerId),
    ownerPolicy('asset_groups'),
  ],
).enableRLS()

export const assetGroupMembers = pgTable(
  'asset_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => assetGroups.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.assetId] }), ownerPolicy('asset_group_members')],
).enableRLS()

export const assetGroupsRelations = relations(assetGroups, ({ many }) => ({
  members: many(assetGroupMembers),
}))

export const assetGroupMembersRelations = relations(assetGroupMembers, ({ one }) => ({
  group: one(assetGroups, {
    fields: [assetGroupMembers.groupId],
    references: [assetGroups.id],
  }),
  asset: one(assets, { fields: [assetGroupMembers.assetId], references: [assets.id] }),
}))
