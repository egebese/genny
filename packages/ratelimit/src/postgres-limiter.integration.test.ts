import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPostgresLimiter, pruneExpiredBuckets } from './postgres-limiter.ts'
import { ruleFor } from './rules.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await startTestDatabase()
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`truncate rate_limit_buckets`)
})

describe('postgres limiter', () => {
  it('allows up to the limit and then refuses', async () => {
    const limiter = createPostgresLimiter(database.app)
    const rule = { bucket: 'test:allow', limit: 3, windowSeconds: 60 }

    const verdicts = []
    for (let i = 0; i < 5; i++) verdicts.push(await limiter.check(rule))

    expect(verdicts.map((v) => v.allowed)).toEqual([true, true, true, false, false])
    expect(verdicts[0]?.remaining).toBe(2)
    expect(verdicts[2]?.remaining).toBe(0)
  })

  it('does not let a burst of parallel requests exceed the limit', async () => {
    const limiter = createPostgresLimiter(database.app)
    const rule = { bucket: 'test:burst', limit: 5, windowSeconds: 60 }

    const results = await Promise.all(Array.from({ length: 25 }, () => limiter.check(rule)))
    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })

  it('does not inflate the counter with refused attempts', async () => {
    const limiter = createPostgresLimiter(database.app)
    const rule = { bucket: 'test:no-inflate', limit: 2, windowSeconds: 60 }
    for (let i = 0; i < 10; i++) await limiter.check(rule)

    const rows = await database.owner.execute<{ count: number }>(
      sql`select count from rate_limit_buckets where bucket = 'test:no-inflate'`,
    )
    expect(rows[0]?.count).toBe(2)
  })

  it('keeps separate buckets independent', async () => {
    const limiter = createPostgresLimiter(database.app)
    await limiter.check({ bucket: 'a', limit: 1, windowSeconds: 60 })
    const other = await limiter.check({ bucket: 'b', limit: 1, windowSeconds: 60 })
    expect(other.allowed).toBe(true)
  })

  it('reports a reset time at the end of the current window', async () => {
    const limiter = createPostgresLimiter(database.app)
    const verdict = await limiter.check({ bucket: 'test:reset', limit: 1, windowSeconds: 60 })
    const delta = verdict.resetAt.getTime() - Date.now()
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeLessThanOrEqual(60_000)
  })

  it('starts a fresh allowance in a new window', async () => {
    const limiter = createPostgresLimiter(database.app)
    const rule = { bucket: 'test:window', limit: 1, windowSeconds: 1 }
    expect((await limiter.check(rule)).allowed).toBe(true)
    expect((await limiter.check(rule)).allowed).toBe(false)

    // Move the recorded window into the past rather than sleeping through it.
    await database.owner.execute(
      sql`update rate_limit_buckets set window_start = window_start - interval '10 seconds' where bucket = 'test:window'`,
    )
    expect((await limiter.check(rule)).allowed).toBe(true)
  })

  it('prunes only windows that are already over', async () => {
    const limiter = createPostgresLimiter(database.app)
    await limiter.check({ bucket: 'fresh', limit: 5, windowSeconds: 60 })
    await database.owner.execute(sql`
      insert into rate_limit_buckets (bucket, window_start, count)
      values ('stale', now() - interval '2 hours', 5)
    `)

    const pruned = await pruneExpiredBuckets(database.app, 3600)
    expect(pruned).toBe(1)
    const left = await database.owner.execute<{ bucket: string }>(
      sql`select bucket from rate_limit_buckets`,
    )
    expect(left.map((r) => r.bucket)).toEqual(['fresh'])
  })

  it('rejects nonsense rules instead of silently allowing everything', async () => {
    const limiter = createPostgresLimiter(database.app)
    await expect(limiter.check({ bucket: '', limit: 5, windowSeconds: 60 })).rejects.toThrow()
    await expect(limiter.check({ bucket: 'x', limit: 0, windowSeconds: 60 })).rejects.toThrow()
    await expect(limiter.check({ bucket: 'x', limit: 5, windowSeconds: 0 })).rejects.toThrow()
  })

  it('limits anonymous generation harder than signed-in generation', () => {
    expect(ruleFor('anonymousGeneration', 'ip').limit).toBeLessThan(
      ruleFor('userGeneration', 'actor').limit,
    )
  })
})
