import { buildStorageKey } from '@genny/assets/keys.ts'
import { toLabelSlug, uniqueLabel } from '@genny/assets/labels.ts'
import { isWithinSizeLimit, MAX_BYTES, SNIFF_BYTES, sniffMediaType } from '@genny/assets/media.ts'
import { type AssetRecord, createAsset, takenLabels } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { storage } from '@/features/studio/server/storage.ts'

export type UploadOutcome =
  | { ok: true; asset: AssetRecord }
  | { ok: false; reason: string; status: number }

/*
 * The file goes through the server rather than straight to the bucket with a
 * presigned PUT. One round trip more, and two problems fewer: the bytes are
 * verified before an asset row exists, and there is no orphaned object to clean
 * up when a client abandons an upload half way.
 *
 * ponytail: single-step upload; move to presigned PUT when video sizes make the
 * round trip through our server the bottleneck.
 */
export async function uploadAsset(
  actorId: string,
  file: File,
  desiredLabel?: string | undefined,
): Promise<UploadOutcome> {
  if (file.size === 0) return refuse('That file is empty.', 400)
  // Reject on the declared size before reading the body into memory.
  if (file.size > MAX_BYTES.video) return refuse('That file is too large.', 413)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength < SNIFF_BYTES) return refuse('That file is too small to be media.', 400)

  const type = sniffMediaType(bytes)
  if (!type) return refuse('Only images, video and audio can be uploaded.', 415)
  if (!isWithinSizeLimit(type.kind, bytes.byteLength)) {
    const limitMb = Math.round(MAX_BYTES[type.kind] / (1024 * 1024))
    return refuse(`That ${type.kind} is larger than the ${limitMb} MB limit.`, 413)
  }

  const db = appDb(env().DATABASE_URL)
  const used = await withActor(db, actorId, (tx) => takenLabels(tx))
  const label = uniqueLabel(desiredLabel ?? toLabelSlug(file.name), used)

  const key = buildStorageKey(actorId, type.extension)
  await storage().put(key, bytes, type.mime)

  const asset = await withActor(db, actorId, (tx) =>
    createAsset(tx, {
      ownerId: actorId,
      kind: type.kind,
      label,
      storageKey: key,
      mime: type.mime,
      bytes: bytes.byteLength,
      source: 'upload',
    }),
  )
  return { ok: true, asset }
}

function refuse(reason: string, status: number): UploadOutcome {
  return { ok: false, reason, status }
}
