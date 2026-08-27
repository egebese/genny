'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { cn } from '@genny/ui/cn.ts'
import { Skeleton } from '@genny/ui/skeleton.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import type { CanvasNodeView } from '../node-view.ts'

type CanvasNodeProps = {
  node: CanvasNodeView
  selected: boolean
  viewport: Viewport
  onSelect: () => void
  onMove: (position: { x: number; y: number }) => void
  onCommit: (position: { x: number; y: number }) => void
  onDelete: () => void
}

/**
 * One placed rectangle.
 *
 * `role="option"` inside the board's listbox, not a button: the node is a thing
 * you select, and a button holding a video is a keyboard trap dressed as a
 * widget. Selection follows focus, and the arrow keys nudge whatever is
 * selected rather than scrolling the page.
 */
export function CanvasNode(props: CanvasNodeProps) {
  const { node, selected, viewport } = props

  function startDrag(event: React.PointerEvent) {
    // Left button only, and never from inside a media control.
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('video, audio, a, button')) return
    event.stopPropagation()
    props.onSelect()

    const origin = { x: event.clientX, y: event.clientY }
    const start = { x: node.x, y: node.y }
    let last = start
    let moved = false

    const move = (dragged: PointerEvent) => {
      last = {
        x: Math.round(start.x + (dragged.clientX - origin.x) / viewport.zoom),
        y: Math.round(start.y + (dragged.clientY - origin.y) / viewport.zoom),
      }
      moved = true
      props.onMove(last)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (moved) props.onCommit(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  return (
    <div
      role="option"
      tabIndex={0}
      aria-label={describe(node)}
      aria-selected={selected}
      onPointerDown={startDrag}
      onFocus={props.onSelect}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 8
        const nudge: Record<string, { x: number; y: number }> = {
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
        }
        const delta = nudge[event.key]
        if (delta) {
          event.preventDefault()
          event.stopPropagation()
          props.onCommit({ x: node.x + delta.x, y: node.y + delta.y })
          return
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          props.onDelete()
        }
      }}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      className={cn(
        'absolute m-0 cursor-grab touch-none select-none outline-none',
        'ring-offset-2 ring-offset-surface',
        selected ? 'ring-2 ring-accent' : 'focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <NodeBody node={node} />
    </div>
  )
}

function NodeBody({ node }: { node: CanvasNodeView }) {
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

  if (node.kind === 'video') {
    return (
      // Controls rather than a custom scrubber: the native one is keyboard
      // reachable and already translated into every language we are not.
      //
      // biome-ignore lint/a11y/useMediaCaption: freshly generated media has no caption track and an empty one claims otherwise
      <video
        src={node.url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-cover"
      />
    )
  }

  if (node.kind === 'audio') {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-2 border border-line bg-surface px-3">
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

function describe(node: CanvasNodeView): string {
  if (node.status === 'pending') return 'Generating'
  if (node.status === 'failed') return `Failed: ${node.error ?? 'no reason given'}`
  return `${node.kind ?? 'result'} ${node.label ?? ''}`.trim()
}
