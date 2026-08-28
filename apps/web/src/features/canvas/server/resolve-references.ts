import { findGroupsByIds } from '@genny/assets/groups.ts'
import { findAssetsByIds } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import type { appDb } from '@genny/db/connection.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { uploadReference } from '@genny/fal/upload.ts'
import type { ResolvedAttachment } from '@genny/models/attachments.ts'
import type { PromptReference } from '@genny/models/references.ts'
import { storage } from '@/features/storage.ts'

/**
 * Turns the asset ids the client sent into urls a model can fetch, in the order
 * the client listed them. Anything the actor cannot see is skipped, so a guessed
 * id reveals nothing.
 *
 * The url has to be reachable *by fal*, which our own bucket often is not: in
 * development it is localhost, and in production it may be private. So each
 * reference is handed to fal and its url is used instead.
 */
export async function resolveReferences(
  db: ReturnType<typeof appDb>,
  actorId: string,
  credentials: FalCredentials,
  requested: { token: string; label: string; kind: 'asset' | 'group'; id: string }[],
): Promise<PromptReference[]> {
  if (requested.length === 0) return []

  const assetIds = requested.filter((item) => item.kind === 'asset').map((item) => item.id)
  const characterIds = requested.filter((item) => item.kind === 'group').map((item) => item.id)

  const [foundAssets, foundCharacters] = await withActor(db, actorId, async (tx) => [
    await findAssetsByIds(tx, assetIds),
    await findGroupsByIds(tx, characterIds),
  ])
  const assetById = new Map(foundAssets.map((asset) => [asset.id, asset]))
  const characterById = new Map(foundCharacters.map((character) => [character.id, character]))

  const bucket = storage()
  const resolved: PromptReference[] = []

  for (const item of requested) {
    /*
     * A character contributes one reference per member, all under the same token.
     * The mapping in the catalog then decides how many the model can take, and
     * the rest come back as dropped.
     */
    const members =
      item.kind === 'group'
        ? (characterById.get(item.id)?.members ?? [])
        : assetById.has(item.id)
          ? [assetById.get(item.id) as { storageKey: string; mime: string }]
          : []

    for (const member of members) {
      const bytes = await bucket.get(member.storageKey)
      resolved.push({
        token: item.token,
        label: item.label,
        url: await uploadReference(credentials, bytes, member.mime),
      })
    }
  }
  return resolved
}

/**
 * The same trip to fal, for assets pinned to a named field rather than mentioned
 * in the prompt.
 *
 * The lookup goes through withActor, so RLS decides what this actor may attach.
 * An id belonging to somebody else is simply not found and the attachment is
 * skipped, which is why the ids arriving from the client need no ownership check.
 */
export async function resolveAttachments(
  db: ReturnType<typeof appDb>,
  actorId: string,
  credentials: FalCredentials,
  requested: { field: string; assetId: string }[],
): Promise<ResolvedAttachment[]> {
  if (requested.length === 0) return []

  const found = await withActor(db, actorId, (tx) =>
    findAssetsByIds(
      tx,
      requested.map((item) => item.assetId),
    ),
  )
  const byId = new Map(found.map((asset) => [asset.id, asset]))

  const bucket = storage()
  const resolved: ResolvedAttachment[] = []
  for (const item of requested) {
    const asset = byId.get(item.assetId)
    if (!asset) continue
    const bytes = await bucket.get(asset.storageKey)
    resolved.push({
      field: item.field,
      url: await uploadReference(credentials, bytes, asset.mime),
    })
  }
  return resolved
}
