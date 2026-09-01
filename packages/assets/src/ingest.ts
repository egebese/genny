import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import { logger } from '@genny/env/log.ts'
import { buildStorageKey } from './keys.ts'
import { toLabelSlug, uniqueLabel } from './labels.ts'
import { isWithinSizeLimit, MAX_BYTES, SNIFF_BYTES, sniffMediaType } from './media.ts'
import { type AssetRecord, createAsset, takenLabels } from './repository.ts'
import type { Storage } from './storage.ts'

/**
 * fal keeps generated media for about a week, so a gallery pointing at fal urls
 * quietly empties itself. Every output is copied into our own bucket and the
 * asset row points at that copy.
 */
export type IngestRequest = {
  db: Database
  storage: Storage
  ownerId: string
  jobId: string
  /** Urls exactly as fal returned them. */
  urls: string[]
  /** Suggested handle, usually derived from the prompt. */
  labelHint: string
}

export type IngestOutcome = {
  assets: AssetRecord[]
  /** Urls that could not be ingested, with why. Surfaced, never swallowed. */
  failures: { url: string; reason: string }[]
}

/**
 * fal serves media from its own CDN and nowhere else. Restricting the fetch to
 * those hosts means a manipulated payload cannot turn ingestion into a
 * server-side request forgery against something on our network.
 */
const ALLOWED_HOSTS = /(^|\.)fal\.media$|(^|\.)fal\.run$/

export async function ingestOutputs(request: IngestRequest): Promise<IngestOutcome> {
  const { db, storage, ownerId, jobId } = request
  const created: AssetRecord[] = []
  const failures: { url: string; reason: string }[] = []

  // Every label this call can produce is `<stem>`, `<stem>-2` and so on, so
  // the stem is the only part of the library that can collide with it.
  const stem = toLabelSlug(request.labelHint)
  const used = new Set(await withActor(db, ownerId, (tx) => takenLabels(tx, stem)))

  for (const [index, url] of request.urls.entries()) {
    try {
      const fetched = await fetchMedia(url)
      const label = uniqueLabel(
        request.urls.length > 1
          ? `${toLabelSlug(request.labelHint)}-${index + 1}`
          : request.labelHint,
        used,
      )
      const key = buildStorageKey(ownerId, fetched.type.extension)
      await storage.put(key, fetched.bytes, fetched.type.mime)

      const asset = await withActor(db, ownerId, (tx) =>
        createAsset(tx, {
          ownerId,
          kind: fetched.type.kind,
          label,
          storageKey: key,
          mime: fetched.type.mime,
          bytes: fetched.bytes.byteLength,
          source: 'generation',
          jobId,
        }),
      )
      used.add(label)
      created.push(asset)
    } catch (error) {
      failures.push({ url, reason: error instanceof Error ? error.message : 'unknown error' })
    }
  }

  if (failures.length > 0) {
    // The job still completes and hands back fal's urls, which expire in about
    // a week. Nothing else says this happened, so an asset that quietly went
    // missing seven days later had no explanation anywhere.
    log.error('outputs not ingested', { jobId, failures })
  }
  return { assets: created, failures }
}

async function fetchMedia(
  url: string,
): Promise<{ bytes: Uint8Array; type: ReturnType<typeof sniffMediaType> & object }> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.test(parsed.hostname)) {
    throw new Error(`refusing to fetch media from ${parsed.hostname}`)
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error(`fal returned ${response.status} for this output`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < SNIFF_BYTES) throw new Error('output was too small to be media')

  const type = sniffMediaType(bytes)
  if (!type) throw new Error('output was not a media type we recognise')
  if (!isWithinSizeLimit(type.kind, bytes.byteLength)) {
    throw new Error(`output exceeds the ${MAX_BYTES[type.kind]} byte limit for ${type.kind}`)
  }
  return { bytes, type }
}

const log = logger('assets')
