'use client'

import { cn } from '@genny/ui/cn.ts'
import type { AssetView } from '../server/list.ts'

type AssetCardProps = {
  asset: AssetView
  selected: boolean
  onToggle: (id: string) => void
}

/**
 * One asset, with the handle a prompt would use. The whole card is the checkbox
 * label, so selecting works by clicking anywhere on it and the keyboard reaches
 * it through the input.
 */
export function AssetCard({ asset, selected, onToggle }: AssetCardProps) {
  return (
    <li>
      <label
        className={cn(
          'block cursor-pointer overflow-hidden rounded-(--radius-panel) border bg-surface transition-colors',
          'focus-within:ring-2 focus-within:ring-accent',
          selected ? 'border-accent' : 'border-line hover:border-ink-faint',
        )}
      >
        <span className="relative block aspect-square bg-canvas">
          {asset.kind === 'image' ? (
            <img
              src={asset.url}
              alt={asset.label}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : asset.kind === 'video' ? (
            <video
              src={asset.url}
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-ink-faint text-sm">
              audio
            </span>
          )}
          {selected ? (
            <span className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-accent-ink text-xs">
              picked
            </span>
          ) : null}
        </span>

        <span className="block space-y-1 p-3">
          <span className="block truncate font-mono text-ink text-sm">@{asset.label}</span>
          <span className="block text-ink-faint text-xs">{formatBytes(asset.bytes)}</span>
        </span>

        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          onChange={() => onToggle(asset.id)}
        />
      </label>
    </li>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
