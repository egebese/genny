import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withActor, withoutActor } from './actor.ts'
import { assets } from './schema/assets.ts'
import { users } from './schema/auth.ts'
import { canvasNodes, projects } from './schema/canvas.ts'
import { startTestDatabase, type TestDatabase } from './testing/container.ts'

let database: TestDatabase
let alice: string
let bob: string

async function createActor(db: TestDatabase, kind: 'anonymous' | 'registered' = 'anonymous') {
  const [row] = await db.owner.insert(users).values({ kind }).returning({ id: users.id })
  if (!row) throw new Error('failed to create test actor')
  return row.id
}

beforeAll(async () => {
  database = await startTestDatabase()
  alice = await createActor(database)
  bob = await createActor(database)
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

/**
 * The driver wraps a Postgres error in a generic "Failed query" error, so a
 * plain rejects.toThrow(/policy/) matches nothing useful. Walk the cause chain
 * and assert against the message Postgres actually produced.
 */
async function expectPgError(work: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await work
  } catch (error) {
    const messages: string[] = []
    let current: unknown = error
    while (current instanceof Error) {
      messages.push(current.message)
      current = current.cause
    }
    expect(messages.join(' | ')).toMatch(pattern)
    return
  }
  throw new Error(`expected a Postgres error matching ${pattern}, the query succeeded`)
}

const assetFixture = (ownerId: string, label: string) => ({
  ownerId,
  label,
  kind: 'image' as const,
  storageKey: `u/${ownerId}/${label}.png`,
  mime: 'image/png',
  bytes: 1024,
  source: 'upload' as const,
})

describe('row level security', () => {
  it('lets an actor create and read its own asset', async () => {
    const rows = await withActor(database.app, alice, async (tx) => {
      await tx.insert(assets).values(assetFixture(alice, 'alice-one'))
      return tx.select({ label: assets.label }).from(assets)
    })
    expect(rows.map((r) => r.label)).toEqual(['alice-one'])
  })

  it('hides one actor rows from another', async () => {
    await withActor(database.app, bob, async (tx) => {
      await tx.insert(assets).values(assetFixture(bob, 'bob-one'))
    })
    const aliceView = await withActor(database.app, alice, (tx) =>
      tx.select({ label: assets.label }).from(assets),
    )
    expect(aliceView.map((r) => r.label)).toEqual(['alice-one'])

    const bobView = await withActor(database.app, bob, (tx) =>
      tx.select({ label: assets.label }).from(assets),
    )
    expect(bobView.map((r) => r.label)).toEqual(['bob-one'])
  })

  it('refuses an insert that claims another actor as owner', async () => {
    await expectPgError(
      withActor(database.app, bob, (tx) => tx.insert(assets).values(assetFixture(alice, 'forged'))),
      /row-level security/i,
    )
  })

  it('refuses to update a row belonging to another actor', async () => {
    const updated = await withActor(database.app, bob, (tx) =>
      tx
        .update(assets)
        .set({ label: 'hijacked' })
        .where(sql`label = 'alice-one'`)
        .returning({ label: assets.label }),
    )
    expect(updated).toEqual([])
  })

  it('refuses to delete a row belonging to another actor', async () => {
    const deleted = await withActor(database.app, bob, (tx) =>
      tx.delete(assets).where(sql`label = 'alice-one'`).returning({ label: assets.label }),
    )
    expect(deleted).toEqual([])
    const stillThere = await withActor(database.app, alice, (tx) =>
      tx.select({ label: assets.label }).from(assets),
    )
    expect(stillThere.map((r) => r.label)).toEqual(['alice-one'])
  })

  it('shows nothing at all when no actor context is set', async () => {
    const rows = await withoutActor(database.app, (tx) =>
      tx.select({ label: assets.label }).from(assets),
    )
    expect(rows).toEqual([])
  })

  it('does not leak actor context to the next transaction on a pooled connection', async () => {
    // set_config(..., is_local => true) is scoped to its transaction. Postgres
    // resets it to an empty string afterwards rather than to NULL, which is why
    // the policy predicate wraps it in nullif.
    await withActor(database.app, alice, (tx) => tx.select().from(assets))
    const leaked = await withoutActor(database.app, (tx) =>
      tx.execute(sql`select current_setting('app.actor_id', true) as actor`),
    )
    expect(leaked[0]?.actor ?? '').toBe('')
    expect(leaked[0]?.actor ?? '').not.toBe(alice)
  })

  it('keeps the credit ledger append-only for the application role', async () => {
    await expectPgError(
      withActor(database.app, alice, (tx) =>
        tx.execute(sql`update credit_ledger set delta = 999 where owner_id = ${alice}`),
      ),
      /permission denied/i,
    )
    await expectPgError(
      withActor(database.app, alice, (tx) =>
        tx.execute(sql`delete from credit_ledger where owner_id = ${alice}`),
      ),
      /permission denied/i,
    )
  })

  it('hides one actor canvas from another', async () => {
    const projectId = await withActor(database.app, alice, async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({ ownerId: alice, title: 'Alice board' })
        .returning({ id: projects.id })
      if (!project) throw new Error('project insert returned no row')
      await tx.insert(canvasNodes).values({
        projectId: project.id,
        ownerId: alice,
        x: 0,
        y: 0,
        width: 512,
        height: 512,
      })
      return project.id
    })

    const seen = await withActor(database.app, bob, (tx) =>
      tx.select({ id: projects.id }).from(projects),
    )
    expect(seen).toHaveLength(0)

    const nodes = await withActor(database.app, bob, (tx) =>
      tx.select({ id: canvasNodes.id }).from(canvasNodes),
    )
    expect(nodes).toHaveLength(0)

    /*
     * The composite foreign key, not a policy. RLS would let this insert through
     * because the row bob is writing is owned by bob; only the key ties the node
     * to a project with the same owner.
     */
    await expectPgError(
      withActor(database.app, bob, (tx) =>
        tx
          .insert(canvasNodes)
          .values({ projectId, ownerId: bob, x: 0, y: 0, width: 512, height: 512 }),
      ),
      /canvas_nodes_project_owner_fk/,
    )
  })

  it('lets every actor read the shared model catalog', async () => {
    await database.owner.execute(sql`
      insert into models (endpoint_id, modality, "group", display_name, unit, unit_price_usd, catalog_hash)
      values ('fal-ai/test', 'image', 'test', 'Test', 'images', 0.01, 'deadbeef')
    `)
    const rows = await withActor(database.app, bob, (tx) =>
      tx.execute(sql`select endpoint_id from models`),
    )
    expect(rows).toHaveLength(1)
  })

  it('does not let the application role write the model catalog', async () => {
    // A missing policy is not an error in Postgres: the UPDATE simply matches no
    // rows. What matters is that the catalog is unchanged afterwards.
    await withActor(database.app, bob, (tx) =>
      tx.execute(sql`update models set enabled = false where endpoint_id = 'fal-ai/test'`),
    )
    const rows = await database.owner.execute(
      sql`select enabled from models where endpoint_id = 'fal-ai/test'`,
    )
    expect(rows[0]?.enabled).toBe(true)
  })
})
