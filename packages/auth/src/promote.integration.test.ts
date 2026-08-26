import { withActor } from '@genny/db/actor.ts'
import { assets } from '@genny/db/schema/assets.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { promoteAnonymousActor } from './promote.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await startTestDatabase()
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from assets`)
  await database.owner.execute(sql`delete from users`)
})

async function anonymous(): Promise<string> {
  const [row] = await database.owner
    .insert(users)
    .values({ kind: 'anonymous' })
    .returning({ id: users.id })
  return row?.id ?? ''
}

const profile = { email: 'ege@example.com', name: 'Ege', image: null }

describe('promoteAnonymousActor', () => {
  it('keeps the same row, so nothing the actor owns has to move', async () => {
    const actorId = await anonymous()
    await withActor(database.app, actorId, (tx) =>
      tx.insert(assets).values({
        ownerId: actorId,
        kind: 'image',
        label: 'made-before-signup',
        storageKey: `u/${actorId}/a.png`,
        mime: 'image/png',
        bytes: 10,
        source: 'upload',
      }),
    )

    const result = await promoteAnonymousActor(database.owner, actorId, profile)
    expect(result).toEqual({ outcome: 'promoted', userId: actorId })

    const stillMine = await withActor(database.app, actorId, (tx) =>
      tx.select({ label: assets.label }).from(assets),
    )
    expect(stillMine.map((row) => row.label)).toEqual(['made-before-signup'])
  })

  it('records the profile and marks the actor registered', async () => {
    const actorId = await anonymous()
    await promoteAnonymousActor(database.owner, actorId, profile)

    const [row] = await database.owner
      .select({ kind: users.kind, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, actorId))
    expect(row).toMatchObject({ kind: 'registered', email: 'ege@example.com', name: 'Ege' })
  })

  it('is a no-op for someone already signed in', async () => {
    const actorId = await anonymous()
    await promoteAnonymousActor(database.owner, actorId, profile)
    const again = await promoteAnonymousActor(database.owner, actorId, profile)
    expect(again).toEqual({ outcome: 'already-registered', userId: actorId })
  })

  it('hands back the established account when the email already belongs to one', async () => {
    const first = await anonymous()
    await promoteAnonymousActor(database.owner, first, profile)

    // Same person, second device: a fresh anonymous actor signing in as them.
    const second = await anonymous()
    const result = await promoteAnonymousActor(database.owner, second, profile)

    expect(result).toEqual({ outcome: 'email-taken', userId: first })
    const [stillAnonymous] = await database.owner
      .select({ kind: users.kind })
      .from(users)
      .where(eq(users.id, second))
    expect(stillAnonymous?.kind).toBe('anonymous')
  })

  it('never creates a second row for the same email', async () => {
    const first = await anonymous()
    const second = await anonymous()
    await promoteAnonymousActor(database.owner, first, profile)
    await promoteAnonymousActor(database.owner, second, profile)

    const rows = await database.owner
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, profile.email))
    expect(rows).toHaveLength(1)
  })

  it('reports an actor that does not exist rather than inventing one', async () => {
    const result = await promoteAnonymousActor(
      database.owner,
      '11111111-2222-3333-4444-555555555555',
      profile,
    )
    expect(result).toEqual({ outcome: 'no-such-actor' })
  })
})
