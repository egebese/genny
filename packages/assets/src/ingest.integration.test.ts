import { withActor } from '@genny/db/actor.ts'
import { users } from '@genny/db/schema/auth.ts'
import { jobs } from '@genny/db/schema/jobs.ts'
import { models } from '@genny/db/schema/models.ts'
import { startTestDatabase, type TestDatabase } from '@genny/db/testing/container.ts'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ingestOutputs } from './ingest.ts'
import { listAssets } from './repository.ts'
import type { Storage } from './storage.ts'

let database: TestDatabase
let owner: string
let jobId: string

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(64).fill(1)])

/** Records what was written without needing a bucket. */
function fakeStorage(): Storage & { written: { key: string; mime: string; bytes: number }[] } {
  const written: { key: string; mime: string; bytes: number }[] = []
  return {
    written,
    async put(key, body, mime) {
      written.push({ key, mime, bytes: body.byteLength })
    },
    async get() {
      return new Uint8Array()
    },
    async presignUpload() {
      return 'https://example.invalid/upload'
    },
    async presignDownload() {
      return 'https://example.invalid/download'
    },
    async remove() {},
  }
}

function stubFetch(handler: (url: string) => { status: number; body?: Uint8Array }) {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const { status, body } = handler(String(input))
    return {
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () => (body ?? new Uint8Array()).buffer,
    } as unknown as Response
  })
}

beforeAll(async () => {
  database = await startTestDatabase()
  await database.owner.insert(models).values({
    endpointId: 'fal-ai/test',
    modality: 'image',
    group: 'Text to Image',
    displayName: 'Test',
    unit: 'images',
    unitPriceUsd: '0.08',
    catalogHash: 'deadbeefdeadbeef',
  })
  const [actor] = await database.owner
    .insert(users)
    .values({ kind: 'anonymous' })
    .returning({ id: users.id })
  owner = actor?.id ?? ''
  const [job] = await database.owner
    .insert(jobs)
    .values({
      ownerId: owner,
      endpointId: 'fal-ai/test',
      prompt: { text: 'a paper crane', references: [] },
      input: {},
    })
    .returning({ id: jobs.id })
  jobId = job?.id ?? ''
}, 180_000)

afterAll(async () => {
  await database?.stop()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const run = (urls: string[], labelHint = 'a paper crane') => {
  const storage = fakeStorage()
  return ingestOutputs({ db: database.app, storage, ownerId: owner, jobId, urls, labelHint }).then(
    (outcome) => ({ outcome, storage }),
  )
}

describe('ingestOutputs', () => {
  it('copies a generation into storage and records it', async () => {
    stubFetch(() => ({ status: 200, body: PNG }))
    const { outcome, storage } = await run(['https://v3b.fal.media/files/b/one.png'])

    expect(outcome.failures).toEqual([])
    expect(outcome.assets).toHaveLength(1)
    expect(outcome.assets[0]?.mime).toBe('image/png')
    expect(outcome.assets[0]?.source).toBe('generation')
    expect(storage.written[0]?.key).toMatch(new RegExp(`^u/${owner}/`))
  })

  it('refuses to fetch media from anywhere but fal, so ingestion is not an SSRF', async () => {
    stubFetch(() => ({ status: 200, body: PNG }))
    const { outcome, storage } = await run([
      'http://169.254.169.254/latest/meta-data/',
      'https://internal.example.com/secret.png',
      'https://fal.media.evil.com/x.png',
    ])

    expect(outcome.assets).toEqual([])
    expect(outcome.failures).toHaveLength(3)
    expect(outcome.failures.every((f) => /refusing to fetch/.test(f.reason))).toBe(true)
    expect(storage.written).toEqual([])
  })

  it('refuses anything that is not media, whatever it claims to be', async () => {
    const html = new Uint8Array([...Buffer.from('<!DOCTYPE html><html>'), ...Array(32).fill(0)])
    stubFetch(() => ({ status: 200, body: html }))
    const { outcome } = await run(['https://v3b.fal.media/files/b/two.png'])

    expect(outcome.assets).toEqual([])
    expect(outcome.failures[0]?.reason).toMatch(/not a media type/)
  })

  it('reports a failed fetch rather than swallowing it', async () => {
    stubFetch(() => ({ status: 404 }))
    const { outcome } = await run(['https://v3b.fal.media/files/b/gone.png'])
    expect(outcome.failures[0]?.reason).toMatch(/404/)
  })

  it('ingests what it can and reports the rest', async () => {
    stubFetch((url) => (url.includes('good') ? { status: 200, body: PNG } : { status: 500 }))
    const { outcome } = await run([
      'https://v3b.fal.media/files/b/good.png',
      'https://v3b.fal.media/files/b/bad.png',
    ])
    expect(outcome.assets).toHaveLength(1)
    expect(outcome.failures).toHaveLength(1)
  })

  it('gives every output of one job a distinct label', async () => {
    stubFetch(() => ({ status: 200, body: PNG }))
    const { outcome } = await run(
      ['https://v3b.fal.media/a.png', 'https://v3b.fal.media/b.png', 'https://v3b.fal.media/c.png'],
      'twin crane',
    )
    const labels = outcome.assets.map((asset) => asset.label)
    expect(new Set(labels).size).toBe(3)
  })

  it('does not collide with labels an earlier job already took', async () => {
    stubFetch(() => ({ status: 200, body: PNG }))
    await run(['https://v3b.fal.media/x.png'], 'repeated name')
    const { outcome } = await run(['https://v3b.fal.media/y.png'], 'repeated name')
    expect(outcome.assets[0]?.label).toBe('repeated-name-2')
  })

  it('leaves the assets readable only by their owner', async () => {
    stubFetch(() => ({ status: 200, body: PNG }))
    await run(['https://v3b.fal.media/owned.png'], 'owned thing')

    const [stranger] = await database.owner
      .insert(users)
      .values({ kind: 'anonymous' })
      .returning({ id: users.id })
    const theirView = await withActor(database.app, stranger?.id ?? '', (tx) =>
      listAssets(tx, { limit: 50 }),
    )
    expect(theirView).toEqual([])
  })
})
