'use client'

import { looksGrouped, matches } from '@genny/assets/search.ts'
import { useState } from 'react'
import type { AssetView, MentionableView } from '../server/list.ts'
import { AssetCard } from './asset-card.tsx'
import { GroupBar } from './group-bar.tsx'
import { GroupList } from './group-list.tsx'
import { UploadZone } from './upload-zone.tsx'

type AssetLibraryProps = {
  initialAssets: AssetView[]
  initialGroups: MentionableView[]
}

export function AssetLibrary({ initialAssets, initialGroups }: AssetLibraryProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [groups, setGroups] = useState(initialGroups)
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const shown = assets.filter((asset) => matches(asset, query))
  /*
   * Offers, not groups. Four shots that a model says are the same product is a
   * strong hint and not a decision: only the person knows whether they meant
   * one product or four listings. Hidden once anything is picked by hand, so
   * the page is never proposing one selection while holding another.
   */
  const offers = selected.length === 0 ? looksGrouped(assets).slice(0, 3) : []

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

      <GroupList
        groups={groups}
        onDeleted={(id) => setGroups((current) => current.filter((c) => c.id !== id))}
      />

      {offers.length > 0 ? (
        <section aria-label="Suggested groups" className="space-y-2">
          {offers.map((offer) => (
            <button
              key={offer.groupKey}
              type="button"
              onClick={() => setSelected(offer.assets.map((asset) => asset.id))}
              className="flex w-full items-center gap-3 rounded-(--radius-panel) border border-line bg-surface p-2 text-left outline-none hover:border-ink-faint focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex shrink-0 -space-x-2">
                {offer.assets.slice(0, 4).map((asset) => (
                  <img
                    key={asset.id}
                    src={asset.url}
                    alt=""
                    loading="lazy"
                    className="size-8 rounded-[3px] object-cover ring-1 ring-canvas"
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink text-sm">
                {offer.assets.length} of these look like{' '}
                <span className="font-mono">{offer.groupKey}</span>
              </span>
              <span className="shrink-0 text-ink-faint text-xs">Group them</span>
            </button>
          ))}
        </section>
      ) : null}

      {selected.length > 0 ? (
        <GroupBar
          selectedIds={selected}
          suggestion={suggestionFor(assets, selected)}
          onCreated={(character) => setGroups((current) => [character, ...current])}
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

/** The key these all share, when they do, so the bar can propose a name. */
function suggestionFor(
  assets: AssetView[],
  selected: string[],
): { kind: string; label: string } | undefined {
  const keys = new Set(
    assets.filter((asset) => selected.includes(asset.id)).map((asset) => asset.facts?.groupKey),
  )
  const [only] = [...keys]
  if (keys.size !== 1 || !only) return undefined

  const kind = assets.find((asset) => asset.facts?.groupKey === only)?.facts?.kind
  return { label: only, kind: kind === 'product' || kind === 'character' ? kind : 'set' }
}
