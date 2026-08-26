import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { publicReadPolicy } from '../rls.ts'

export const modality = pgEnum('modality', ['image', 'video', 'audio'])

/**
 * Operational layer over packages/models/catalog. The JSON files in the repo are
 * the truth about what a model is; this table is the truth about how we sell it
 * today: enabled, ordered, and with a credit multiplier an operator can change
 * without shipping a release. Seeded by `pnpm db:seed:models`.
 */
export const models = pgTable(
  'models',
  {
    endpointId: text('endpoint_id').primaryKey(),
    modality: modality('modality').notNull(),
    group: text('group').notNull(),
    displayName: text('display_name').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    featured: boolean('featured').notNull().default(false),
    /** USD per unit as published by fal, mirrored from the catalog file. */
    unit: text('unit').notNull(),
    unitPriceUsd: numeric('unit_price_usd', { precision: 12, scale: 6 }).notNull(),
    /** Operator markup on top of the catalog price. 1.0 means no markup. */
    creditMultiplier: numeric('credit_multiplier', { precision: 6, scale: 3 })
      .notNull()
      .default('1.0'),
    /** Fingerprint of the catalog file, so drift between repo and DB is visible. */
    catalogHash: text('catalog_hash').notNull(),
    capabilities: jsonb('capabilities').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [publicReadPolicy('models')],
).enableRLS()
