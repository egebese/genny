import { recordChange } from '@genny/billing/ledger.ts'
import { createBilling } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import { createJob, findJob } from '@genny/db/repositories/jobs.ts'
import { claimJobSettlement } from '@genny/db/repositories/jobs-settlement.ts'
import { users } from '@genny/db/schema/auth.ts'
import { models } from '@genny/db/schema/models.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sweepStrandedJobs } from './sweep.ts'

let database: TestDatabase
let owner: string

const ENDPOINT = 'fal-ai/flux/schnell'

beforeAll(async () => {
  database = await startTestDatabase()
  const created = await database.owner
    .insert(users)
    .values([{ kind: 'registered' }])
    .returning({ id: users.id })
  owner = created[0]?.id ?? ''

  // jobs.endpoint_id is a foreign key: a job can only name a model we sell.
  await database.owner.insert(models).values({
    endpointId: ENDPOINT,
    modality: 'image',
    group: 'test',
    displayName: 'Test model',
    unit: 'images',
    unitPriceUsd: '0.01',
    catalogHash: 'test',
  })
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from jobs`)
  await database.owner.execute(sql`delete from credit_ledger`)
  await database.owner.execute(sql`delete from credit_balance`)
})

/** A job that has been sitting unwatched for `ageMinutes`, with credits held. */
async function strandedJob(ageMinutes: number, held: string) {
  await recordChange(database.owner, {
    ownerId: owner,
    delta: '1000',
    kind: 'grant',
    idempotencyKey: `grant:${ageMinutes}:${held}`,
  })
  const billing = createBilling('saas', database.app)
  await billing.hold(owner, held)

  const job = await withActor(database.app, owner, (tx) =>
    createJob(tx, {
      ownerId: owner,
      endpointId: ENDPOINT,
      prompt: { text: 'a quiet street', references: [] },
      input: {},
      creditsHeld: held,
    }),
  )
  await database.owner.execute(
    sql`update jobs set created_at = now() - ${`${ageMinutes} minutes`}::interval where id = ${job.id}`,
  )
  return job
}

function sweep(overrides: { staleAfterMs?: number; abandonAfterMs?: number } = {}) {
  return sweepStrandedJobs({
    db: database.app,
    ownerDb: database.owner,
    // byok's situation, and the one the test wants: no key, so no verdict from
    // fal and the expiry path is the only thing that can settle these.
    fal: null,
    billing: createBilling('saas', database.app),
    ...overrides,
  })
}

describe('sweepStrandedJobs', () => {
  it('returns the credits of a job that never came back', async () => {
    const job = await strandedJob(90, '100')
    const before = await createBilling('saas', database.app).balance(owner)
    expect(before).toEqual({ balance: '900.0000', holdBalance: '100.0000' })

    const report = await sweep()
    expect(report).toEqual({ checked: 1, settled: 0, expired: 1 })

    const after = await createBilling('saas', database.app).balance(owner)
    expect(after).toEqual({ balance: '1000.0000', holdBalance: '0.0000' })

    const row = await withActor(database.app, owner, (tx) => findJob(tx, job.id))
    expect(row?.status).toBe('failed')
    expect(row?.error).toMatch(/returned/)
  })

  it('leaves a job alone while someone could still be watching it', async () => {
    const job = await strandedJob(1, '100')

    const report = await sweep()
    expect(report).toEqual({ checked: 0, settled: 0, expired: 0 })

    const row = await withActor(database.app, owner, (tx) => findJob(tx, job.id))
    expect(row?.status).toBe('queued')
  })

  it('waits out the abandon window rather than failing a job fal may still answer', async () => {
    const job = await strandedJob(10, '100')

    // Old enough to look at, not old enough to write off.
    const report = await sweep()
    expect(report).toEqual({ checked: 1, settled: 0, expired: 0 })

    const row = await withActor(database.app, owner, (tx) => findJob(tx, job.id))
    expect(row?.status).toBe('queued')
  })

  it('does not double-refund a job it already expired', async () => {
    await strandedJob(90, '100')

    await sweep()
    const second = await sweep()
    expect(second).toEqual({ checked: 0, settled: 0, expired: 0 })

    const after = await createBilling('saas', database.app).balance(owner)
    expect(after).toEqual({ balance: '1000.0000', holdBalance: '0.0000' })
  })

  it('settles a job with no hold, which is what byok always looks like', async () => {
    const job = await withActor(database.app, owner, (tx) =>
      createJob(tx, {
        ownerId: owner,
        endpointId: ENDPOINT,
        prompt: { text: 'a quiet street', references: [] },
        input: {},
      }),
    )
    await database.owner.execute(
      sql`update jobs set created_at = now() - interval '90 minutes' where id = ${job.id}`,
    )

    const report = await sweep()
    expect(report.expired).toBe(1)

    const row = await withActor(database.app, owner, (tx) => findJob(tx, job.id))
    expect(row?.status).toBe('failed')
  })
})

describe('claimJobSettlement', () => {
  const FIVE_MINUTES = 5 * 60 * 1000

  it('lets exactly one settler through', async () => {
    const job = await strandedJob(10, '100')
    const claims = await Promise.all(
      [1, 2, 3].map(() =>
        withActor(database.app, owner, (tx) => claimJobSettlement(tx, job.id, FIVE_MINUTES)),
      ),
    )
    expect(claims.filter(Boolean)).toHaveLength(1)
  })

  it('hands the job to someone else once a claim goes stale', async () => {
    const job = await strandedJob(10, '100')
    expect(await claim(job.id)).toBe(true)
    expect(await claim(job.id)).toBe(false)

    await database.owner.execute(
      sql`update jobs set settling_at = now() - interval '10 minutes' where id = ${job.id}`,
    )
    expect(await claim(job.id)).toBe(true)
  })

  it('refuses a job that is already finished', async () => {
    const job = await strandedJob(10, '100')
    await database.owner.execute(sql`update jobs set status = 'completed' where id = ${job.id}`)
    expect(await claim(job.id)).toBe(false)
  })

  function claim(jobId: string) {
    return withActor(database.app, owner, (tx) => claimJobSettlement(tx, jobId, FIVE_MINUTES))
  }
})
