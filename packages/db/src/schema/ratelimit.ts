import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Fixed-window counters, keyed by whatever the limiter decides to bucket on: an
 * ip, an actor id, an actor plus an endpoint. Not tenant data and not addressed
 * by owner, so RLS is deliberately left off. Redis, when configured, replaces
 * this table entirely; it is never a requirement.
 */
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    bucket: text('bucket').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
)
