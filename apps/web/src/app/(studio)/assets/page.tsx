import type { Metadata } from 'next'
import { listAssetsFor, listMentionablesFor } from '@/features/assets/server/list.ts'
import { AssetLibrary } from '@/features/assets/ui/asset-library.tsx'
import { readActorId } from '@/features/session/actor.ts'

export const metadata: Metadata = { title: 'Assets' }

export default async function AssetsPage() {
  const actorId = await readActorId()
  if (!actorId) return <AssetLibrary initialAssets={[]} initialCharacters={[]} />

  const [assets, mentionables] = await Promise.all([
    listAssetsFor(actorId),
    listMentionablesFor(actorId),
  ])
  return (
    <AssetLibrary
      initialAssets={assets}
      initialCharacters={mentionables.filter((item) => item.kind === 'character')}
    />
  )
}
