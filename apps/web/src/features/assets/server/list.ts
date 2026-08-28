import { listGroups } from '@genny/assets/groups.ts'
import { type AssetRecord, listAssets } from '@genny/assets/repository.ts'
import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { type AssetFacts, factsFor } from '@genny/db/repositories/asset-facts.ts'
import { env } from '@genny/env/env.ts'
import type { MediaKind } from '@genny/models/aspect.ts'

/** What the browser needs about an asset. Storage keys stay on the server. */
export type AssetView = {
  id: string
  label: string
  kind: 'image' | 'video' | 'audio'
  url: string
  mime: string
  bytes: number
  createdAt: string
  /**
   * What a model said this is, when one has been asked.
   *
   * Null is the ordinary case, not a failure: cataloguing costs money, so it
   * runs on what somebody keeps rather than on everything that lands.
   */
  facts: Omit<AssetFacts, 'assetId' | 'analysedAt'> | null
}

/**
 * Anything a prompt can point at with `@`. A character is one entry that stands
 * for several images, so the mention list treats both the same and only the
 * server needs to know the difference.
 */
export type MentionableView = {
  id: string
  label: string
  kind: 'asset' | 'group'
  /**
   * What it is. A group is always stills, because that is what a group is for;
   * an asset is whatever it is. The list says so, and until the catalog had
   * models that take a clip or a sound it said "image" about all of them.
   */
  media: MediaKind
  /** A single image for the asset, or the character's first member. */
  previewUrl: string | null
  /** How many images this contributes. Always 1 for an asset. */
  count: number
}

export async function listAssetsFor(
  actorId: string,
  options: { limit?: number | undefined; kind?: AssetView['kind'] | undefined } = {},
): Promise<AssetView[]> {
  const db = appDb(env().DATABASE_URL)
  const rows = await withActor(db, actorId, (tx) =>
    listAssets(tx, { limit: options.limit ?? 60, kind: options.kind }),
  )
  // One extra query for the whole page rather than one per card. Most rows have
  // no description, so this is usually a short list.
  const described = await withActor(db, actorId, (tx) =>
    factsFor(
      tx,
      rows.map((row) => row.id),
    ),
  )
  const byId = new Map(described.map((facts) => [facts.assetId, facts]))
  return rows.map((row) => ({ ...toView(row), facts: factsOf(byId.get(row.id)) }))
}

function factsOf(facts: AssetFacts | undefined): AssetView['facts'] {
  if (!facts) return null
  const { assetId: _id, analysedAt: _at, ...rest } = facts
  return rest
}

/**
 * The mentionable list: groups first, because a group is the more
 * specific thing to reach for and is usually what someone wants.
 */
export async function listMentionablesFor(actorId: string): Promise<MentionableView[]> {
  const db = appDb(env().DATABASE_URL)
  const [assetGroups, assets] = await withActor(db, actorId, async (tx) => [
    await listGroups(tx),
    // Not stills only. Video upscalers, video editing and voice cloning all
    // take something else, and a clip that cannot be mentioned cannot be given
    // to the one model in the catalog that exists to work on it.
    await listAssets(tx, { limit: 60 }),
  ])

  return [
    ...assetGroups.map((character) => ({
      id: character.id,
      label: character.label,
      kind: 'group' as const,
      media: 'image' as const,
      previewUrl: character.members[0]
        ? assetUrl({
            id: character.members[0].assetId,
            label: character.label,
            storageKey: character.members[0].storageKey,
          })
        : null,
      count: character.members.length,
    })),
    ...assets.map((asset) => ({
      id: asset.id,
      label: asset.label,
      kind: 'asset' as const,
      media: asset.kind,
      previewUrl: asset.kind === 'image' ? assetUrl(asset) : null,
      count: 1,
    })),
  ]
}

export function toView(asset: AssetRecord): AssetView {
  return {
    id: asset.id,
    label: asset.label,
    kind: asset.kind,
    url: assetUrl(asset),
    mime: asset.mime,
    bytes: asset.bytes,
    createdAt: asset.createdAt.toISOString(),
    facts: null,
  }
}
