import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withActor } from '../actor.ts'
import { users } from '../schema/auth.ts'
import { models } from '../schema/models.ts'
import { startTestDatabase, type TestDatabase } from '../testing/container.ts'
import {
  attachFalRequest,
  cancelJob,
  completeJob,
  createJob,
  failJob,
  findJob,
  listJobs,
  markJobRunning,
  type StoredPrompt,
} from './jobs.ts'

let database: TestDatabase
let alice: string
let bob: string

const ENDPOINT = 'fal-ai/test-endpoint'
const prompt: StoredPrompt = { text: 'a shiba inu chef', references: [] }

beforeAll(async () => {
  database = await startTestDatabase()
  await database.owner.insert(models).values({
    endpointId: ENDPOINT,
    modality: 'image',
    group: 'Text to Image',
    displayName: 'Test',
    unit: 'images',
    unitPriceUsd: '0.08',
    catalogHash: 'deadbeefdeadbeef',
  })
  const created = await database.owner
    .insert(users)
    .values([{ kind: 'anonymous' }, { kind: 'anonymous' }])
    .returning({ id: users.id })
  alice = created[0]?.id ?? ''
  bob = created[1]?.id ?? ''
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

const newJob = (ownerId: string) =>
  withActor(database.app, ownerId, (tx) =>
    createJob(tx, { ownerId, endpointId: ENDPOINT, prompt, input: { prompt: prompt.text } }),
  )

describe('jobs repository', () => {
  it('creates a job an actor can read back', async () => {
    const created = await newJob(alice)
    expect(created.status).toBe('queued')

    const found = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(found?.prompt).toEqual(prompt)
    expect(found?.input).toEqual({ prompt: prompt.text })
  })

  it('hides one actor job from another', async () => {
    const created = await newJob(alice)
    const asBob = await withActor(database.app, bob, (tx) => findJob(tx, created.id))
    expect(asBob).toBeNull()
  })

  it('records the fal request id and moves the job to running', async () => {
    const created = await newJob(alice)
    await withActor(database.app, alice, (tx) =>
      attachFalRequest(tx, created.id, `req-${created.id}`),
    )

    const found = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(found?.status).toBe('running')
    expect(found?.falRequestId).toBe(`req-${created.id}`)
  })

  it('refuses two jobs for the same fal request, so a retry cannot charge twice', async () => {
    const first = await newJob(alice)
    const second = await newJob(alice)
    await withActor(database.app, alice, (tx) => attachFalRequest(tx, first.id, 'shared-request'))

    await expect(
      withActor(database.app, alice, (tx) => attachFalRequest(tx, second.id, 'shared-request')),
    ).rejects.toThrow()
  })

  it('completes a job with its output', async () => {
    const created = await newJob(alice)
    await withActor(database.app, alice, (tx) =>
      completeJob(tx, created.id, { images: [{ url: 'https://cdn/a.png' }] }, '100'),
    )

    const found = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(found?.status).toBe('completed')
    expect(found?.creditsCharged).toBe('100.0000')
    expect(found?.finishedAt).toBeInstanceOf(Date)
  })

  it('stores a failure reason and truncates a runaway message', async () => {
    const created = await newJob(alice)
    await withActor(database.app, alice, (tx) => failJob(tx, created.id, 'x'.repeat(2000)))

    const found = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(found?.status).toBe('failed')
    expect(found?.error).toHaveLength(500)
  })

  it('does not move a finished job back to running', async () => {
    const created = await newJob(alice)
    await withActor(database.app, alice, async (tx) => {
      await completeJob(tx, created.id, {})
      await markJobRunning(tx, created.id)
    })
    const found = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(found?.status).toBe('completed')
  })

  it('lists only the actor own jobs, newest first', async () => {
    await database.owner.execute(sql`delete from jobs`)
    for (let i = 0; i < 3; i++) await newJob(alice)
    await newJob(bob)

    const mine = await withActor(database.app, alice, (tx) => listJobs(tx, { limit: 10 }))
    expect(mine).toHaveLength(3)
    const timestamps = mine.map((job) => job.createdAt.getTime())
    expect([...timestamps]).toEqual([...timestamps].sort((a, b) => b - a))
  })

  it('pages with a keyset rather than an offset', async () => {
    await database.owner.execute(sql`delete from jobs`)
    for (let i = 0; i < 5; i++) await newJob(alice)

    const firstPage = await withActor(database.app, alice, (tx) => listJobs(tx, { limit: 2 }))
    const cursor = firstPage.at(-1)?.createdAt
    const secondPage = await withActor(database.app, alice, (tx) =>
      listJobs(tx, { limit: 2, before: cursor }),
    )

    expect(firstPage).toHaveLength(2)
    expect(secondPage).toHaveLength(2)
    const overlap = secondPage.filter((job) => firstPage.some((seen) => seen.id === job.id))
    expect(overlap).toEqual([])
  })

  it('cancels a job that is still running', async () => {
    const created = await newJob(alice)
    const stopped = await withActor(database.app, alice, (tx) => cancelJob(tx, created.id))
    expect(stopped).toBe(true)

    const row = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(row?.status).toBe('canceled')
    expect(row?.finishedAt).not.toBeNull()
  })

  /*
   * The race the conditional update exists for. A cancel and a settlement can
   * both be in flight, and writing `canceled` over a completed job would leave
   * a generation whose outputs are ingested and whose credits are captured
   * claiming it never ran.
   */
  it('loses to a settlement rather than overwriting it', async () => {
    const created = await newJob(alice)
    await withActor(database.app, alice, (tx) =>
      completeJob(tx, created.id, { images: [{ url: 'https://cdn/a.png' }] }, '100'),
    )

    const stopped = await withActor(database.app, alice, (tx) => cancelJob(tx, created.id))
    expect(stopped).toBe(false)

    const row = await withActor(database.app, alice, (tx) => findJob(tx, created.id))
    expect(row?.status).toBe('completed')
    expect(row?.creditsCharged).toBe('100.0000')
  })

  it('caps an absurd page size instead of trusting it', async () => {
    const rows = await withActor(database.app, alice, (tx) => listJobs(tx, { limit: 10_000 }))
    expect(rows.length).toBeLessThanOrEqual(50)
  })
})
