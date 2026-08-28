import { withActor } from '@genny/db/actor.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createGroup,
  deleteGroup,
  findGroupsByIds,
  listGroups,
  takenGroupLabels,
} from './groups.ts'
import { createAsset } from './repository.ts'

let database: TestDatabase
let owner: string
let stranger: string

beforeAll(async () => {
  database = await startTestDatabase()
  const created = await database.owner
    .insert(users)
    .values([{ kind: 'anonymous' }, { kind: 'anonymous' }])
    .returning({ id: users.id })
  owner = created[0]?.id ?? ''
  stranger = created[1]?.id ?? ''
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from asset_groups`)
  await database.owner.execute(sql`delete from assets`)
})

async function makeAssets(ownerId: string, labels: string[]) {
  return withActor(database.app, ownerId, async (tx) => {
    const made = []
    for (const label of labels) {
      made.push(
        await createAsset(tx, {
          ownerId,
          kind: 'image',
          label,
          storageKey: `u/${ownerId}/${label}.png`,
          mime: 'image/png',
          bytes: 1024,
          source: 'upload',
        }),
      )
    }
    return made
  })
}

describe('asset groups', () => {
  it('bundles assets under one handle, in the order given', async () => {
    const made = await makeAssets(owner, ['front', 'side', 'back'])
    const character = await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'ayse', assetIds: made.map((a) => a.id) }),
    )

    expect(character.label).toBe('ayse')
    expect(character.members).toHaveLength(3)
    expect(character.members.map((m) => m.storageKey)).toEqual(made.map((a) => a.storageKey))
  })

  it('refuses a character with no assets, which could never resolve', async () => {
    await expect(
      withActor(database.app, owner, (tx) =>
        createGroup(tx, { ownerId: owner, label: 'empty', assetIds: [] }),
      ),
    ).rejects.toThrow(/at least one asset/)
  })

  it('refuses a duplicate handle for the same owner', async () => {
    const made = await makeAssets(owner, ['one'])
    const create = () =>
      withActor(database.app, owner, (tx) =>
        createGroup(tx, { ownerId: owner, label: 'twin', assetIds: [made[0]?.id ?? ''] }),
      )
    await create()
    await expect(create()).rejects.toThrow()
  })

  it('lets two owners use the same handle', async () => {
    const mine = await makeAssets(owner, ['mine'])
    const theirs = await makeAssets(stranger, ['theirs'])

    await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'shared', assetIds: [mine[0]?.id ?? ''] }),
    )
    await expect(
      withActor(database.app, stranger, (tx) =>
        createGroup(tx, {
          ownerId: stranger,
          label: 'shared',
          assetIds: [theirs[0]?.id ?? ''],
        }),
      ),
    ).resolves.toBeTruthy()
  })

  it('hides one owner groups from another', async () => {
    const made = await makeAssets(owner, ['hidden'])
    await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'secret', assetIds: [made[0]?.id ?? ''] }),
    )

    const theirView = await withActor(database.app, stranger, (tx) => listGroups(tx))
    expect(theirView).toEqual([])
  })

  it('does not resolve a character id belonging to somebody else', async () => {
    const made = await makeAssets(owner, ['guarded'])
    const character = await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'guarded', assetIds: [made[0]?.id ?? ''] }),
    )

    const found = await withActor(database.app, stranger, (tx) =>
      findGroupsByIds(tx, [character.id]),
    )
    expect(found).toEqual([])
  })

  it('refuses to bundle an asset the owner cannot see', async () => {
    const theirs = await makeAssets(stranger, ['not-mine'])
    await expect(
      withActor(database.app, owner, (tx) =>
        createGroup(tx, { ownerId: owner, label: 'theft', assetIds: [theirs[0]?.id ?? ''] }),
      ),
    ).rejects.toThrow()
  })

  it('reports taken handles so a new one can avoid colliding', async () => {
    const made = await makeAssets(owner, ['a', 'b'])
    await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'taken-one', assetIds: [made[0]?.id ?? ''] }),
    )
    const taken = await withActor(database.app, owner, (tx) => takenGroupLabels(tx))
    expect(taken).toContain('taken-one')
  })

  it('deletes a character without touching its assets', async () => {
    const made = await makeAssets(owner, ['keep-me'])
    const character = await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'temporary', assetIds: [made[0]?.id ?? ''] }),
    )

    expect(await withActor(database.app, owner, (tx) => deleteGroup(tx, character.id))).toBe(true)
    expect(await withActor(database.app, owner, (tx) => listGroups(tx))).toEqual([])

    const assetsLeft = await database.owner.execute<{ count: string }>(
      sql`select count(*) from assets`,
    )
    expect(Number(assetsLeft[0]?.count)).toBe(1)
  })

  it('cannot delete somebody else character', async () => {
    const made = await makeAssets(owner, ['safe'])
    const character = await withActor(database.app, owner, (tx) =>
      createGroup(tx, { ownerId: owner, label: 'safe', assetIds: [made[0]?.id ?? ''] }),
    )
    expect(await withActor(database.app, stranger, (tx) => deleteGroup(tx, character.id))).toBe(
      false,
    )
  })
})
