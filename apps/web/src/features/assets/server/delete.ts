import 'server-only'
import { softDeleteAsset } from '@genny/assets/repository.ts'
import { THUMB_WIDTHS, thumbKeyFor } from '@genny/assets/thumbnail.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { logger, reason } from '@genny/env/log.ts'
import { storage } from '@/features/storage.ts'

/**
 * Deletes an asset: the row is tombstoned, the bytes actually go.
 *
 * There was no way to delete anything at all. `deleteAsset` and `Storage.remove`
 * had both been written and neither had a caller, so a library only ever grew
 * and nothing anyone uploaded could be taken back.
 *
 * The row first. If the bucket is unreachable the asset is still gone from
 * every listing, every mention and everything handed to fal, which is what
 * somebody deleting it actually asked for; a few orphaned objects is the
 * cheaper failure. The other order leaves bytes deleted under a row that still
 * claims to have them.
 */
export async function deleteAssetFor(
  actorId: string,
  assetId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const db = appDb(env().DATABASE_URL)
  const asset = await withActor(db, actorId, (tx) => softDeleteAsset(tx, assetId))

  // Not theirs, or already gone. RLS makes those the same answer, which is the
  // right one: telling them apart tells a stranger what exists.
  if (!asset) return { ok: false, reason: 'That asset is not there.' }

  const store = storage()
  // The derived thumbnails too. They are generated lazily per width, so some of
  // these were never made; a delete of an object that is not there is a no-op
  // on S3 and every compatible bucket.
  const keys = [asset.storageKey, ...THUMB_WIDTHS.map((w) => thumbKeyFor(asset.storageKey, w))]
  await Promise.all(
    keys.map((key) =>
      store.remove(key).catch((error: unknown) => {
        log.error('object left behind after a delete', { key, reason: reason(error) })
      }),
    ),
  )

  return { ok: true }
}

const log = logger('assets')
