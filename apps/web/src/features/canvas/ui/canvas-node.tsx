'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { cn } from '@genny/ui/cn.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { NodeMedia } from './node-media.tsx'

type CanvasNodeProps = {
  node: CanvasNodeView
  selected: boolean
  viewport: Viewport
  /** Space is down, so this drag belongs to the board rather than to the node. */
  panMode: boolean
  onSelect: (additive: boolean) => void
  onInspect: () => void
  /** Raw client coordinates; only the board knows where its own top left is. */
  onContextMenu: (at: { clientX: number; clientY: number }) => void
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
    // Space turns the whole board into a pan surface, nodes included.
    if (props.panMode) return
    event.stopPropagation()
    props.onSelect(event.shiftKey || event.metaKey)

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
      onContextMenu={(event) => {
        event.preventDefault()
        props.onContextMenu({ clientX: event.clientX, clientY: event.clientY })
      }}
      /*
       * Only when it is not already picked. A right-click focuses the node
       * before its menu opens, and collapsing a marquee selection to one at that
       * moment is how "attach these four" turns into "attach this one".
       */
      onFocus={() => {
        if (!selected) props.onSelect(false)
      }}
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
        'group absolute m-0 cursor-grab touch-none select-none outline-none',
        'ring-offset-2 ring-offset-surface',
        selected ? 'ring-2 ring-accent' : 'focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <NodeMedia node={node} />
      <InspectButton node={node} selected={selected} onInspect={props.onInspect} />
    </div>
  )
}

/**
 * The way into the details, on the media rather than on the whole node.
 *
 * Selecting and inspecting were the same click, so dragging something into place
 * kept opening a panel over the thing being placed. Now a click selects and this
 * opens.
 *
 * Shown on hover, and whenever the node is selected or holds focus. That second
 * half is not decoration: a phone has no hover, so tapping the node is the only
 * way this can ever appear.
 */
function InspectButton(props: { node: CanvasNodeView; selected: boolean; onInspect: () => void }) {
  if (props.node.status === 'pending') return null

  return (
    <button
      type="button"
      aria-label="Generation details"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={props.onInspect}
      className={cn(
        'absolute top-2 right-2 flex size-(--size-touch) items-center justify-center rounded-full',
        'bg-canvas/70 font-mono text-ink text-sm backdrop-blur transition-opacity',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        props.selected
          ? 'opacity-100'
          : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
      )}
    >
      i
    </button>
  )
}

function describe(node: CanvasNodeView): string {
  if (node.status === 'pending') return 'Generating'
  if (node.status === 'failed') return `Failed: ${node.error ?? 'no reason given'}`
  return `${node.kind ?? 'result'} ${node.label ?? ''}`.trim()
}
