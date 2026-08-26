'use client'

import type { AssetView } from '../server/list.ts'

/** One asset, with the handle a prompt would use to refer to it. */
export function AssetCard({ asset }: { asset: AssetView }) {
  return (
    <li className="overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
      <div className="aspect-square bg-canvas">
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
          <div className="flex size-full items-center justify-center text-ink-faint text-sm">
            audio
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate font-mono text-sm text-ink">@{asset.label}</p>
        <p className="text-ink-faint text-xs">{formatBytes(asset.bytes)}</p>
      </div>
    </li>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
