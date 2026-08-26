import { findCredentials } from '@genny/db/repositories/actors.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { verifyPassword } from './password.ts'
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
