import { findCharactersByIds } from '@genny/assets/characters.ts'
import { findAssetsByIds } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import type { appDb } from '@genny/db/connection.ts'
import type { FalCredentials } from '@genny/fal/credentials.ts'
import { uploadReference } from '@genny/fal/upload.ts'
import type { PromptReference } from '@genny/models/references.ts'
import { storage } from './storage.ts'

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
  requested: { token: string; label: string; kind: 'asset' | 'character'; id: string }[],
): Promise<PromptReference[]> {
  if (requested.length === 0) return []

  const assetIds = requested.filter((item) => item.kind === 'asset').map((item) => item.id)
  const characterIds = requested.filter((item) => item.kind === 'character').map((item) => item.id)

  const [foundAssets, foundCharacters] = await withActor(db, actorId, async (tx) => [
    await findAssetsByIds(tx, assetIds),
    await findCharactersByIds(tx, characterIds),
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
      item.kind === 'character'
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
