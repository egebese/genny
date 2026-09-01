import { withActor } from '@genny/db/actor.ts'
import { users } from '@genny/db/schema/auth.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createAsset,
  findAssetsByIds,
  listAssets,
  renameAsset,
  softDeleteAsset,
  takenLabels,
} from './repository.ts'

let database: TestDatabase
let owner: string

beforeAll(async () => {
  database = await startTestDatabase()
  const created = await database.owner
    .insert(users)
    .values([{ kind: 'anonymous' }])
    .returning({ id: users.id })
  owner = created[0]?.id ?? ''
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

beforeEach(async () => {
  await database.owner.execute(sql`delete from assets`)
})

function make(label: string) {
  return withActor(database.app, owner, (tx) =>
    createAsset(tx, {
      ownerId: owner,
      kind: 'image',
      label,
      storageKey: `u/${owner}/${label}.png`,
      mime: 'image/png',
      bytes: 1024,
      source: 'upload',
    }),
  )
}

describe('deleting an asset', () => {
  it('takes it out of every listing', async () => {
    const asset = await make('hoodie')
    await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))

    const listed = await withActor(database.app, owner, (tx) => listAssets(tx, { limit: 50 }))
    expect(listed).toEqual([])

    const byId = await withActor(database.app, owner, (tx) => findAssetsByIds(tx, [asset.id]))
    expect(byId).toEqual([])
  })

  /*
   * The reason this is a tombstone and not a DELETE. `canvas_nodes.asset_id`
   * cascades, so a real delete would take every node drawing this picture off
   * somebody's board with no warning and nothing to show them afterwards.
   */
  it('leaves the row behind, so a board can still say the media is gone', async () => {
    const asset = await make('hoodie')
    await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))

    const [row] = await database.owner.execute(
      sql`select deleted_at from assets where id = ${asset.id}`,
    )
    expect(row).toBeDefined()
  })

  it('is idempotent, so the bytes are not deleted twice', async () => {
    const asset = await make('hoodie')
    const first = await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))
    const second = await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))

    expect(first?.storageKey).toContain('hoodie')
    expect(second).toBeNull()
  })

  /*
   * The unique index does not know a row is dead, so a new upload that wants
   * the freed name has to be given `hoodie-2` rather than a constraint
   * violation. This is why takenLabels does not filter tombstones out.
   */
  it('keeps its handle reserved, because the unique index still holds it', async () => {
    const asset = await make('hoodie')
    await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))

    const taken = await withActor(database.app, owner, (tx) => takenLabels(tx, 'hoodie'))
    expect(taken).toContain('hoodie')
  })
})

describe('takenLabels', () => {
  it('asks only about the stem, rather than reading the whole library', async () => {
    await make('hoodie')
    await make('hoodie-2')
    await make('a-completely-different-thing')

    const taken = await withActor(database.app, owner, (tx) => takenLabels(tx, 'hoodie'))
    expect(taken.sort()).toEqual(['hoodie', 'hoodie-2'])
  })
})

describe('renaming an asset', () => {
  it('gives it a new handle', async () => {
    const asset = await make('img-4821')
    const renamed = await withActor(database.app, owner, (tx) =>
      renameAsset(tx, asset.id, 'hero-shot'),
    )
    expect(renamed?.label).toBe('hero-shot')
  })

  it('will not rename one that has been deleted', async () => {
    const asset = await make('img-4821')
    await withActor(database.app, owner, (tx) => softDeleteAsset(tx, asset.id))

    const renamed = await withActor(database.app, owner, (tx) =>
      renameAsset(tx, asset.id, 'hero-shot'),
    )
    expect(renamed).toBeNull()
  })
})
