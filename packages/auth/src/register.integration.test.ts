import {
  deleteActor,
  findCredentials,
  findPasswordHash,
  setPasswordHash,
} from '@genny/db/repositories/actors.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.ts'
import { registerWithPassword } from './register.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await startTestDatabase()
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from users`)
})

async function anonymous(): Promise<string> {
  const [row] = await database.owner
    .insert(users)
    .values({ kind: 'anonymous' })
    .returning({ id: users.id })
  return row?.id ?? ''
}

const PASSWORD = 'a decent passphrase'

describe('registerWithPassword', () => {
  it('keeps the actor id, so nothing they made changes hands', async () => {
    const before = await anonymous()

    const result = await registerWithPassword(database.owner, {
      email: 'Ada@Example.com',
      password: PASSWORD,
      anonymousId: before,
    })

    expect(result).toEqual({ ok: true, userId: before })
  })

  it('stores a hash that verifies, and never the password', async () => {
    const id = await anonymous()
    await registerWithPassword(database.owner, {
      email: 'ada@example.com',
      password: PASSWORD,
      anonymousId: id,
    })

    const account = await findCredentials(database.owner, 'ada@example.com')
    expect(account?.passwordHash).toBeTruthy()
    expect(account?.passwordHash).not.toContain(PASSWORD)
    expect(await verifyPassword(PASSWORD, account?.passwordHash ?? null)).toBe(true)
    expect(await verifyPassword('something else', account?.passwordHash ?? null)).toBe(false)
  })

  it('matches the email however it was typed', async () => {
    const id = await anonymous()
    await registerWithPassword(database.owner, {
      email: '  Ada@Example.COM ',
      password: PASSWORD,
      anonymousId: id,
    })
    expect(await findCredentials(database.owner, 'ADA@example.com')).toMatchObject({ id })
  })

  it('refuses an email that already has an account', async () => {
    await registerWithPassword(database.owner, {
      email: 'ada@example.com',
      password: PASSWORD,
      anonymousId: await anonymous(),
    })

    const second = await registerWithPassword(database.owner, {
      email: 'ada@example.com',
      password: 'a different passphrase',
      anonymousId: await anonymous(),
    })
    expect(second).toEqual({ ok: false, reason: expect.stringContaining('already has an account') })
  })

  it('refuses a password too short to be worth hashing', async () => {
    const result = await registerWithPassword(database.owner, {
      email: 'ada@example.com',
      password: 'short',
      anonymousId: await anonymous(),
    })
    expect(result.ok).toBe(false)
    expect(await findCredentials(database.owner, 'ada@example.com')).toBeNull()
  })

  it('refuses a signup with no actor to promote', async () => {
    const result = await registerWithPassword(database.owner, {
      email: 'ada@example.com',
      password: PASSWORD,
      anonymousId: null,
    })
    expect(result.ok).toBe(false)
  })
})

describe('the account primitives a settings page needs', () => {
  /*
   * `setPasswordHash` shipped with registration under a comment saying it was
   * for a password change, and nothing called it for months. `findPasswordHash`
   * is what makes checking the current one possible: by id, not by email, so a
   * signed-in person cannot aim the check at somebody else's row.
   */
  it('reads back the hash it just wrote, and the new password verifies', async () => {
    const id = await anonymous()
    await registerWithPassword(database.owner, {
      email: 'a@example.com',
      password: PASSWORD,
      anonymousId: id,
    })

    const before = await findPasswordHash(database.owner, id)
    expect(before).not.toBeNull()
    expect(await verifyPassword(PASSWORD, before ?? '')).toBe(true)

    await setPasswordHash(database.owner, id, await hashPassword('an entirely different one'))

    const after = await findPasswordHash(database.owner, id)
    expect(await verifyPassword('an entirely different one', after ?? '')).toBe(true)
    expect(await verifyPassword(PASSWORD, after ?? '')).toBe(false)
  })

  it('has nothing to check for an actor that signs in another way', async () => {
    expect(await findPasswordHash(database.owner, await anonymous())).toBeNull()
  })

  /*
   * Every table carrying an owner_id cascades from users, the credit ledger
   * included, and a foreign key cascade runs as the table owner: it is subject
   * to neither RLS nor the REVOKE that makes the ledger append-only. That is
   * the whole of ADR 0013, and this is the test that says so out loud.
   */
  it('takes the credit ledger with it, despite the append-only grant', async () => {
    const id = await anonymous()
    await database.owner.execute(
      sql`insert into credit_ledger (owner_id, delta, kind, idempotency_key)
          values (${id}, 500, 'grant', 'test-grant')`,
    )

    expect(await deleteActor(database.owner, id)).toBe(true)

    const [left] = await database.owner.execute(
      sql`select count(*)::int as n from credit_ledger where owner_id = ${id}`,
    )
    expect((left as { n: number } | undefined)?.n).toBe(0)
  })

  it('reports that there was nothing to delete', async () => {
    expect(await deleteActor(database.owner, '00000000-0000-4000-8000-000000000000')).toBe(false)
  })
})
