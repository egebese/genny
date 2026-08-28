import { index, integer, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { assets } from './assets.ts'
import { users } from './auth.ts'
import { projects } from './canvas.ts'

/**
 * What a pinned asset is to the project.
 *
 * Three roles, not a free label. They decide how the shelf groups them and what
 * an agent is told the thing is for, and a fourth role nobody thought about
 * would be a heading with no meaning attached.
 */
export const brandRole = pgEnum('brand_role', ['logo', 'product', 'reference'])

/**
 * The project's own material: the logo, the products, the shots to work from.
 *
 * A join table rather than a column on `assets`, because the same photograph is
 * a product shot in one project and a texture reference in another, and because
 * pinning something must not change the asset itself.
 *
 * The palette is not here. Colours are not assets, so they live on the project
 * row and are drawn as swatches rather than as thumbnails.
 */
export const projectAssets = pgTable(
  'project_assets',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: brandRole('role').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  /*
   * Both references are replaced by composite `(id, owner_id)` keys in the
   * migration. drizzle-kit only emits single-column ones, and a key check is
   * not subject to RLS: without the owner in the key, an actor could pin their
   * asset to somebody else's project.
   */
  (t) => [
    primaryKey({ columns: [t.projectId, t.assetId] }),
    index('project_assets_project_role').on(t.projectId, t.role, t.sortOrder),
    ownerPolicy('project_assets'),
  ],
).enableRLS()
