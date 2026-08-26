import { withActor } from '@genny/db/actor.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { captureHold, holdCredits, readBalance, recordChange, releaseHold } from './ledger.ts'

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

const grant = (amount: string, key = `grant-${amount}-${Math.random()}`) =>
  as(owner, (tx) =>
    recordChange(tx, { ownerId: owner, delta: amount, kind: 'grant', idempotencyKey: key }),
  )

/** The invariant the whole design rests on. */
async function assertInvariant(actorId: string) {
  const rows = await database.owner.execute<{ total: string }>(
    sql`select coalesce(sum(delta), 0) as total from credit_ledger where owner_id = ${actorId}`,
  )
  const balance = await as(actorId, (tx) => readBalance(tx, actorId))
  const sum = Number(rows[0]?.total ?? 0)
  expect(sum).toBeCloseTo(Number(balance.balance) + Number(balance.holdBalance), 4)
}

describe('credit ledger', () => {
  it('grants credits and reflects them in the balance', async () => {
    await grant('1000')
    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({ balance: '1000.0000' })
    await assertInvariant(owner)
  })

  it('a hold moves credits out of spendable without changing the total', async () => {
    await grant('1000')
    const held = await as(owner, (tx) => holdCredits(tx, owner, '200'))

    expect(held).toMatchObject({ ok: true, balance: '800.0000', holdBalance: '200.0000' })
    await assertInvariant(owner)
  })

  it('refuses a hold larger than the balance and says by how much', async () => {
    await grant('100')
    const held = await as(owner, (tx) => holdCredits(tx, owner, '250'))

    expect(held).toMatchObject({ ok: false, reason: 'insufficient', shortfall: '150.0000' })
    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({ balance: '100.0000' })
  })

  it('capture charges the real cost and returns the rest of the hold', async () => {
    await grant('1000')
    await as(owner, (tx) => holdCredits(tx, owner, '200'))
    await as(owner, (tx) =>
      captureHold(tx, {
        ownerId: owner,
        held: '200',
        actual: '150',
        jobId: '11111111-2222-3333-4444-555555555555',
        idempotencyKey: 'job-1-capture',
      }),
    )

    const balance = await as(owner, (tx) => readBalance(tx, owner))
    expect(balance).toMatchObject({ balance: '850.0000', holdBalance: '0.0000' })
    await assertInvariant(owner)
  })

  it('capture is idempotent, so a replayed completion charges once', async () => {
    await grant('1000')
    await as(owner, (tx) => holdCredits(tx, owner, '200'))
    const capture = () =>
      as(owner, (tx) =>
        captureHold(tx, {
          ownerId: owner,
          held: '200',
          actual: '150',
          jobId: '11111111-2222-3333-4444-555555555555',
          idempotencyKey: 'replayed',
        }),
      )

    expect(await capture()).toEqual({ applied: true })
    expect(await capture()).toEqual({ applied: false })
    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({ balance: '850.0000' })
    await assertInvariant(owner)
  })

  it('releasing a hold gives everything back and writes no ledger row', async () => {
    await grant('1000')
    await as(owner, (tx) => holdCredits(tx, owner, '300'))
    expect(await as(owner, (tx) => releaseHold(tx, owner, '300'))).toEqual({ applied: true })

    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({
      balance: '1000.0000',
      holdBalance: '0.0000',
    })
    const rows = await database.owner.execute<{ count: string }>(
      sql`select count(*) from credit_ledger where owner_id = ${owner} and kind <> 'grant'`,
    )
    expect(Number(rows[0]?.count)).toBe(0)
    await assertInvariant(owner)
  })

  it('will not release more than is held', async () => {
    await grant('1000')
    await as(owner, (tx) => holdCredits(tx, owner, '100'))
    expect(await as(owner, (tx) => releaseHold(tx, owner, '500'))).toEqual({ applied: false })
    await assertInvariant(owner)
  })

  it('a grant is idempotent, so a replayed webhook grants once', async () => {
    await grant('500', 'same-key')
    await grant('500', 'same-key')
    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({ balance: '500.0000' })
  })

  it('refuses a zero or negative hold rather than pretending it worked', async () => {
    await grant('100')
    await expect(as(owner, (tx) => holdCredits(tx, owner, '0'))).rejects.toThrow(/positive/)
    await expect(as(owner, (tx) => holdCredits(tx, owner, '-5'))).rejects.toThrow(/positive/)
  })

  it('cannot spend another actor credits', async () => {
    await grant('1000')
    // RLS scopes the update to the caller, so the row is simply not there.
    const held = await as(stranger, (tx) => holdCredits(tx, owner, '100'))
    expect(held.ok).toBe(false)
    expect(await as(owner, (tx) => readBalance(tx, owner))).toMatchObject({ balance: '1000.0000' })
  })

  it('cannot read another actor balance', async () => {
    await grant('1000')
    expect(await as(stranger, (tx) => readBalance(tx, owner))).toEqual({
      balance: '0',
      holdBalance: '0',
    })
  })

  it('holds the invariant through a thousand randomised operations', async () => {
    await grant('100000', 'big-grant')

    for (let i = 0; i < 1000; i++) {
      const amount = String(1 + Math.floor(Math.random() * 40))
      const held = await as(owner, (tx) => holdCredits(tx, owner, amount))
      if (!held.ok) continue

      const roll = Math.random()
      if (roll < 0.5) {
        const actual = String(Math.floor(Number(amount) * Math.random()))
        await as(owner, (tx) =>
          captureHold(tx, {
            ownerId: owner,
            held: amount,
            actual,
            jobId: '11111111-2222-3333-4444-555555555555',
            idempotencyKey: `op-${i}`,
          }),
        )
      } else if (roll < 0.9) {
        await as(owner, (tx) => releaseHold(tx, owner, amount))
      }
      // The remaining tenth leaves the hold outstanding, like a crashed job.
    }

    await assertInvariant(owner)
  }, 120_000)

  it('concurrent holds cannot overdraw', async () => {
    await grant('100')
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => as(owner, (tx) => holdCredits(tx, owner, '10'))),
    )

    expect(attempts.filter((a) => a.ok)).toHaveLength(10)
    const balance = await as(owner, (tx) => readBalance(tx, owner))
    expect(Number(balance.balance)).toBeGreaterThanOrEqual(0)
    expect(balance).toMatchObject({ balance: '0.0000', holdBalance: '100.0000' })
    await assertInvariant(owner)
  })
})
