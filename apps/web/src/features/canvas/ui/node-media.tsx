'use client'

import { sourceFor } from '@genny/assets/thumbnail.ts'
import { Skeleton } from '@genny/ui/skeleton.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import type { CanvasNodeView } from '../node-view.ts'
import { VideoPlayer } from './video-player.tsx'

/** What fills a node's rectangle, which is a different thing per kind and per state. */
export function NodeMedia({ node, zoom }: { node: CanvasNodeView; zoom: number }) {
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
      /*
       * A copy the size this node is actually drawn at, not the original.
       *
       * A node is a few hundred pixels across and a generated picture is
       * several thousand: one canvas of thirty-one of them was two hundred and
       * twenty-seven megabytes, every one decoded to a full bitmap and
       * re-rastered on every zoom. Zoom in and the same node asks for a bigger
       * copy, and past four times its size for the original, because that is
       * the point at which somebody is looking at it rather than at the board.
       *
       * The zoom here is the settled one, which changes once when a gesture
       * ends rather than sixty times during it. Quality does not need to keep
       * up with a pinch; it needs to be right when the pinch stops.
       */
      src={sourceFor(node.url, node.width * zoom, dpr())}
      alt={node.label ?? ''}
      draggable={false}
      loading="lazy"
      // Off the main thread. Thirty synchronous decodes is a visible stall on
      // the first paint of a full board.
      decoding="async"
      className="h-full w-full bg-surface object-cover"
    />
  )
}

/** Retina screens draw twice the pixels, and a board that looked soft on one
 * is the first thing anybody notices. One on the server, where there is no
 * screen and the markup is replaced on hydration anyway. */
function dpr(): number {
  return typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
}
