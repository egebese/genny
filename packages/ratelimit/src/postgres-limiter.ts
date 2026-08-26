import type { Database } from '@genny/db/client.ts'
import { sql } from 'drizzle-orm'
import type { Limiter, LimitRule, LimitVerdict } from './limiter.ts'

/**
 * Postgres-backed limiter, so a self-hosted deployment needs exactly one piece of
 * infrastructure. Redis is an optional accelerator, never a prerequisite.
 */
export function createPostgresLimiter(db: Database): Limiter {
  return {
    async check(rule: LimitRule): Promise<LimitVerdict> {
      assertRule(rule)

      // One statement does the whole thing atomically. The WHERE on the conflict
      // path is what makes it correct under concurrency: when the counter is
      // already at the limit no row is returned, so a burst of parallel requests
      // cannot each read "count = limit - 1" and all decide they may proceed.
      const rows = await db.execute<{ count: number; window_start: Date }>(sql`
        insert into rate_limit_buckets (bucket, window_start, count)
        values (
          ${rule.bucket},
          to_timestamp(floor(extract(epoch from now()) / ${rule.windowSeconds}) * ${rule.windowSeconds}),
          1
        )
        on conflict (bucket, window_start) do update
          set count = rate_limit_buckets.count + 1
          where rate_limit_buckets.count < ${rule.limit}
        returning count, window_start
      `)

      const row = rows[0]
      if (!row) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: windowEnd(new Date(), rule.windowSeconds),
        }
      }
      return {
        allowed: true,
        remaining: Math.max(0, rule.limit - row.count),
        resetAt: windowEnd(new Date(row.window_start), rule.windowSeconds),
      }
    },
  }
}

/**
 * Old windows are dead weight, not history. Called by a scheduled sweep; safe to
 * run concurrently with live traffic because it only touches finished windows.
 */
export async function pruneExpiredBuckets(db: Database, olderThanSeconds = 3600): Promise<number> {
  const rows = await db.execute<{ bucket: string }>(sql`
    delete from rate_limit_buckets
    where window_start < now() - make_interval(secs => ${olderThanSeconds})
    returning bucket
  `)
  return rows.length
}

function assertRule(rule: LimitRule): void {
  if (!rule.bucket.trim()) throw new Error('rate limit bucket must not be empty')
  if (!Number.isInteger(rule.limit) || rule.limit < 1)
    throw new Error('limit must be a positive integer')
  if (!Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1) {
    throw new Error('windowSeconds must be a positive integer')
  }
}

function windowEnd(windowStart: Date, windowSeconds: number): Date {
  const aligned = Math.floor(windowStart.getTime() / 1000 / windowSeconds) * windowSeconds
  return new Date((aligned + windowSeconds) * 1000)
}
