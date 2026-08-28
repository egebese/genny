import { stillOnFal } from '@genny/assets/fal-cache.ts'
import { rememberFalUrl } from '@genny/assets/repository.ts'
import type { Database } from '@genny/db/client.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { uploadReference } from '@genny/fal/upload.ts'
import { storage } from '@/features/storage.ts'

export type Uploadable = {
  id: string
  storageKey: string
  mime: string
  falUrl: string | null
  falUrlAt: Date | null
}

/**
 * A url fal can fetch this asset from, uploading it only if it has to.
 *
 * fal's own guidance is to upload once and reuse the url across as many
 * requests as you need. We were uploading the same bytes again on every
 * generation that referenced them: four variants of one photograph meant five
 * round trips of that photograph, one for the agent and one per variant.
 */
export async function falUrlFor(
  tx: Database,
  credentials: FalCredentials,
  asset: Uploadable,
): Promise<string> {
  if (stillOnFal(asset)) return asset.falUrl

  const bytes = await storage().get(asset.storageKey)
  const url = await uploadReference(credentials, bytes, asset.mime)
  await rememberFalUrl(tx, asset.id, url)
  return url
}
