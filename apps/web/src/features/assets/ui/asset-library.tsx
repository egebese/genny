'use client'

import { useState } from 'react'
import type { AssetView } from '../server/list.ts'
import { AssetCard } from './asset-card.tsx'
import { UploadZone } from './upload-zone.tsx'

export function AssetLibrary({ initial }: { initial: AssetView[] }) {
  const [assets, setAssets] = useState(initial)

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="mt-1 text-ink-muted text-sm">
          Everything you upload or generate, ready to mention in a prompt.
        </p>
      </div>

      <UploadZone onUploaded={(asset) => setAssets((current) => [asset, ...current])} />

      {assets.length === 0 ? (
        <p className="py-12 text-center text-ink-faint">Nothing here yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </main>
  )
}
