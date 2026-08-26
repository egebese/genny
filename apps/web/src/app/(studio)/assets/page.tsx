import type { Metadata } from 'next'
import { listAssetsFor } from '@/features/assets/server/list.ts'
import { AssetLibrary } from '@/features/assets/ui/asset-library.tsx'
import { readActorId } from '@/features/session/actor.ts'

export const metadata: Metadata = { title: 'Assets' }

export default async function AssetsPage() {
  const actorId = await readActorId()
  const assets = actorId ? await listAssetsFor(actorId) : []
  return <AssetLibrary initial={assets} />
}
