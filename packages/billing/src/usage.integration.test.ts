import { withActor } from '@genny/db/actor.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { captureHold, holdCredits, recordChange } from './ledger.ts'
import { listLedger, spentSince } from './usage.ts'

let database: TestDatabase
let owner: string
let stranger: string

beforeAll(async () => {
  database = await startTestDatabase()
  const created = await database.owner
    .insert(users)
    .values([{ kind: 'registered' }, { kind: 'registered' }])
    .returning({ id: users.id })
  owner = created[0]?.id ?? ''
  stranger = created[1]?.id ?? ''
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from credit_ledger`)
  await database.owner.execute(sql`delete from credit_balance`)
})

const as = <T>(actorId: string, fn: Parameters<typeof withActor<T>>[2]) =>
  withActor(database.app, actorId, fn)

async function spend(actorId: string, amount: string, jobId: string) {
  await as(actorId, (tx) =>
    recordChange(tx, {
      ownerId: actorId,
      delta: '1000',
      kind: 'grant',
      idempotencyKey: `grant:${jobId}`,
    }),
  )
  await as(actorId, (tx) => holdCredits(tx, actorId, amount))
  await as(actorId, (tx) =>
    captureHold(tx, {
      ownerId: actorId,
      held: amount,
      actual: amount,
      jobId,
      idempotencyKey: `capture:${jobId}`,
    }),
  )
}

const JOB_A = '11111111-1111-1111-1111-111111111111'
const JOB_B = '22222222-2222-2222-2222-222222222222'

describe('usage reads', () => {
  it('gives back a real Date, not whatever the driver felt like', async () => {
    await spend(owner, '30', JOB_A)
    const [entry] = await as(owner, (tx) => listLedger(tx, owner, 10))
    expect(entry?.createdAt).toBeInstanceOf(Date)
    expect(Number.isNaN(entry?.createdAt.getTime())).toBe(false)
  })

  it('counts what was captured, as a positive number', async () => {
    await spend(owner, '30', JOB_A)
    await spend(owner, '12', JOB_B)

    const since = new Date(Date.now() - 60_000)
    expect(await as(owner, (tx) => spentSince(tx, owner, since))).toEqual({
      credits: '42.0000',
      generations: 2,
    })
  })

  it('ignores grants, which are money arriving rather than leaving', async () => {
    await as(owner, (tx) =>
      recordChange(tx, { ownerId: owner, delta: '500', kind: 'grant', idempotencyKey: 'g1' }),
    )
    const since = new Date(Date.now() - 60_000)
    expect(await as(owner, (tx) => spentSince(tx, owner, since))).toEqual({
      credits: '0',
      generations: 0,
    })
  })

  it('counts nothing before the window', async () => {
    await spend(owner, '30', JOB_A)
    const tomorrow = new Date(Date.now() + 86_400_000)
    expect(await as(owner, (tx) => spentSince(tx, owner, tomorrow))).toEqual({
      credits: '0',
      generations: 0,
    })
  })

  it('shows one actor nothing of another, because RLS says so', async () => {
    await spend(owner, '30', JOB_A)
    await spend(stranger, '77', JOB_B)

    const entries = await as(stranger, (tx) => listLedger(tx, stranger, 50))
    expect(entries.map((entry) => entry.delta)).not.toContain('-30.0000')

    // ...and asking for someone else's rows outright returns nothing at all.
    expect(await as(stranger, (tx) => listLedger(tx, owner, 50))).toEqual([])
  })
})
