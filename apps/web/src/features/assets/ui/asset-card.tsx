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
            <span className="absolute top-2 right-2 rounded-(--radius-control) bg-accent px-2 py-0.5 text-accent-ink text-xs">
              picked
            </span>
          ) : null}
        </span>

        {/*
          The name it was given, over the name it arrived with. A slug from a
          filename tells you which upload this was; "Off-white Hoodie, Plinth"
          tells you what it is, which is the question anyone scanning a grid of
          two hundred thumbnails is actually asking.
        */}
        <span className="block space-y-1 p-3">
          <span className="block truncate text-ink text-sm" title={asset.facts?.subject}>
            {asset.facts?.shortName ?? `@${asset.label}`}
          </span>
          <span className="flex items-center gap-2 text-ink-faint text-xs">
            <span className="truncate font-mono">@{asset.label}</span>
            {asset.facts ? (
              <span className="shrink-0 font-mono uppercase tracking-wider">
                {asset.facts.kind}
              </span>
            ) : (
              <span className="shrink-0">{formatBytes(asset.bytes)}</span>
            )}
          </span>
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
