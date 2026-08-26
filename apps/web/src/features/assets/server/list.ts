import { publicUrlFor } from '@genny/assets/keys.ts'
import { type AssetRecord, listAssets } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'

/** What the browser needs about an asset. Storage keys stay on the server. */
export type AssetView = {
  id: string
  label: string
  kind: 'image' | 'video' | 'audio'
  url: string
  mime: string
  bytes: number
  createdAt: string
}

export async function listAssetsFor(
  actorId: string,
  options: { limit?: number | undefined; kind?: AssetView['kind'] | undefined } = {},
): Promise<AssetView[]> {
  const rows = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    listAssets(tx, { limit: options.limit ?? 60, kind: options.kind }),
  )
  return rows.map(toView)
}

export function toView(asset: AssetRecord): AssetView {
  return {
    id: asset.id,
    label: asset.label,
    kind: asset.kind,
    url: publicUrlFor(env().S3_PUBLIC_URL, asset.storageKey),
    mime: asset.mime,
    bytes: asset.bytes,
    createdAt: asset.createdAt.toISOString(),
  }
}
