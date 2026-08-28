'use client'

import { Skeleton } from '@genny/ui/skeleton.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import type { CanvasNodeView } from '../node-view.ts'
import { VideoPlayer } from './video-player.tsx'

/** What fills a node's rectangle, which is a different thing per kind and per state. */
export function NodeMedia({ node }: { node: CanvasNodeView }) {
  if (node.status === 'failed') {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-1 border border-danger/40 bg-danger/5 p-3">
        <span className="font-mono text-[10px] text-danger uppercase tracking-wider">failed</span>
        <p className="line-clamp-4 text-ink-muted text-xs">{node.error ?? 'No reason given.'}</p>
      </div>
    )
  }

  if (node.status === 'pending' || !node.url) {
    return (
      <div className="relative h-full w-full">
        <Skeleton aspect="auto" className="h-full w-full" />
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-ink-muted text-xs">
          <Spinner /> Generating
        </span>
      </div>
    )
  }

  if (node.kind === 'video') return <VideoPlayer src={node.url} />

  if (node.kind === 'audio') {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-2 bg-surface px-3">
        <span className="truncate font-mono text-[10px] text-ink-faint uppercase tracking-wider">
          {node.label}
        </span>
        {/* biome-ignore lint/a11y/useMediaCaption: same as video, there is no transcript to point at */}
        <audio src={node.url} controls className="w-full" />
      </div>
    )
  }

  return (
    <img
      src={node.url}
      alt={node.label ?? ''}
      draggable={false}
      loading="lazy"
      className="h-full w-full bg-surface object-cover"
    />
  )
}
