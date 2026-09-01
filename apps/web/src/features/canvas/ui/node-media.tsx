'use client'

import { sourceFor } from '@genny/assets/thumbnail.ts'
import { Skeleton } from '@genny/ui/skeleton.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import { useState } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { AudioPlayer } from './audio-player.tsx'
import { Elapsed } from './elapsed.tsx'
import { VideoPlayer } from './video-player.tsx'

/** What fills a node's rectangle, which is a different thing per kind and per state. */
export function NodeMedia({ node, zoom }: { node: CanvasNodeView; zoom: number }) {
  const [broke, setBroke] = useState(false)

  if (node.status === 'failed') {
    return (
      <Notice tone="danger" label="failed">
        {node.error ?? 'No reason given.'}
      </Notice>
    )
  }

  /*
   * Nothing is coming. Saying so is the whole point: this used to render as a
   * spinner, so a node whose picture had been deleted looked exactly like one
   * that was three seconds from appearing, forever.
   */
  if (node.status === 'missing' || broke) {
    return (
      <Notice tone="muted" label="no media">
        This result is no longer available.
      </Notice>
    )
  }

  if (node.status === 'pending' || !node.url) {
    return (
      <div className="relative h-full w-full">
        <Skeleton aspect="auto" className="h-full w-full" />
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-ink-muted text-xs">
          <Spinner /> Generating <Elapsed since={node.startedAt} />
        </span>
      </div>
    )
  }

  if (node.kind === 'video') return <VideoPlayer src={node.url} />

  if (node.kind === 'audio') return <AudioPlayer src={node.url} label={node.label} />

  // Anything that is not one of the three known kinds is drawn as a picture,
  // because that is what a generated result almost always is; if it turns out
  // not to be, `onError` below says so rather than leaving a broken frame.
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
      // A url that 404s is the deleted-asset case arriving a second late, and an
      // unannotated broken image icon is the worst way to find out.
      onError={() => setBroke(true)}
      className="h-full w-full bg-surface object-cover"
    />
  )
}

/** The two states that have nothing to draw, so they say something instead. */
function Notice(props: { tone: 'danger' | 'muted'; label: string; children: React.ReactNode }) {
  const danger = props.tone === 'danger'
  return (
    <div
      className={`flex h-full w-full flex-col justify-center gap-1 border p-3 ${
        danger ? 'border-danger/40 bg-danger/5' : 'border-line bg-surface'
      }`}
    >
      <span
        className={`font-mono text-[10px] uppercase tracking-wider ${
          danger ? 'text-danger' : 'text-ink-faint'
        }`}
      >
        {props.label}
      </span>
      <p className="line-clamp-4 text-ink-muted text-xs">{props.children}</p>
    </div>
  )
}

/** Retina screens draw twice the pixels, and a board that looked soft on one
 * is the first thing anybody notices. One on the server, where there is no
 * screen and the markup is replaced on hydration anyway. */
function dpr(): number {
  return typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
}
