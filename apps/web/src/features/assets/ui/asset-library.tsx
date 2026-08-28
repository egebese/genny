'use client'

import { matches } from '@genny/assets/search.ts'
import { useState } from 'react'
import type { AssetView, MentionableView } from '../server/list.ts'
import { AssetCard } from './asset-card.tsx'
import { CharacterBar } from './character-bar.tsx'
import { CharacterList } from './character-list.tsx'
import { UploadZone } from './upload-zone.tsx'

type AssetLibraryProps = {
  initialAssets: AssetView[]
  initialCharacters: MentionableView[]
}

export function AssetLibrary({ initialAssets, initialCharacters }: AssetLibraryProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [characters, setCharacters] = useState(initialCharacters)
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const shown = assets.filter((asset) => matches(asset, query))

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Assets</h1>
        <p className="mt-1 text-ink-muted text-sm">
          Everything you upload or generate, ready to mention in a prompt.
        </p>
      </div>

      {/*
        Over what they are, not over what they are called. A slug taken from a
        filename matches nothing anyone would think to type, which is why the
        search box was never worth having before there was something to search.
      */}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search assets"
        placeholder="Search by what it is: hoodie, overcast, logo"
        className="h-(--size-touch) w-full rounded-(--radius-control) bg-control px-3 text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-accent"
      />

      <UploadZone onUploaded={(asset) => setAssets((current) => [asset, ...current])} />

      <CharacterList
        characters={characters}
        onDeleted={(id) => setCharacters((current) => current.filter((c) => c.id !== id))}
      />

      {selected.length > 0 ? (
        <CharacterBar
          selectedIds={selected}
          onCreated={(character) => setCharacters((current) => [character, ...current])}
          onClear={() => setSelected([])}
        />
      ) : null}

      {shown.length === 0 ? (
        <p className="py-12 text-center text-ink-faint">
          {assets.length === 0 ? 'Nothing here yet.' : 'Nothing matches that.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={selected.includes(asset.id)}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
