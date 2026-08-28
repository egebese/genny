'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { AssetView } from '@/features/assets/server/list.ts'
import { pinAsset, unpinAsset } from '../server/actions.ts'
import type { PinnedAsset, ProjectView } from '../server/project-page.ts'

const ROLES = [
  { role: 'logo', label: 'Logo' },
  { role: 'product', label: 'Product' },
  { role: 'reference', label: 'Reference' },
] as const

/**
 * What the project is made of, and what it is not.
 *
 * The library shows every asset the actor has; pinning one says it belongs to
 * this project and puts it on the shelf of every board in it. Pinning does not
 * copy or move anything: the same photograph can be a product shot here and a
 * texture reference somewhere else.
 */
export function BrandKitEditor({
  project,
  library,
}: {
  project: ProjectView
  library: AssetView[]
}) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const pinnedIds = new Set(project.pinned.map((item) => item.assetId))

  const pin = (assetId: string, role: (typeof ROLES)[number]['role']) =>
    start(async () => {
      await pinAsset({ projectId: project.id, assetId, role })
      router.refresh()
    })

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-medium text-ink">Project material</h2>
      <p className="mb-4 text-ink-faint text-sm">
        Pinned here, these sit on the board of every canvas in this project, one click from the
        prompt.
      </p>

      {project.pinned.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-3">
          {project.pinned.map((item) => (
            <Pinned
              key={item.assetId}
              item={item}
              onRemove={() =>
                start(async () => {
                  await unpinAsset({ projectId: project.id, assetId: item.assetId })
                  router.refresh()
                })
              }
            />
          ))}
        </ul>
      ) : null}

      <h3 className="mb-2 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
        Your assets
      </h3>
      {library.length === 0 ? (
        <p className="text-ink-faint text-sm">Nothing to pin yet. Upload something on /assets.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {library.map((asset) => (
            <li key={asset.id} className="flex flex-col gap-1">
              <div className="aspect-square overflow-hidden rounded-(--radius-control) bg-surface ring-1 ring-line">
                {asset.kind === 'image' ? (
                  <img src={asset.url} alt="" loading="lazy" className="size-full object-cover" />
                ) : null}
              </div>
              <p className="truncate font-mono text-[10px] text-ink-faint">@{asset.label}</p>
              <div className="flex flex-wrap gap-1">
                {ROLES.map(({ role, label }) => (
                  <button
                    key={role}
                    type="button"
                    disabled={busy}
                    onClick={() => pin(asset.id, role)}
                    className="rounded-(--radius-control) bg-control px-2 py-1 text-ink-muted text-xs outline-none disabled:opacity-40 hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {pinnedIds.has(asset.id) ? `→ ${label}` : label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Pinned({ item, onRemove }: { item: PinnedAsset; onRemove: () => void }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="relative size-20 overflow-hidden rounded-(--radius-control) bg-surface ring-1 ring-line">
        {item.kind === 'image' ? (
          <img src={item.url} alt={item.label} className="size-full object-cover" />
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Unpin ${item.label}`}
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-[3px] bg-canvas/80 text-ink-muted outline-none backdrop-blur hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="close" className="size-3" />
        </button>
      </div>
      <p className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">{item.role}</p>
    </li>
  )
}
