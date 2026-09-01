'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import type { Guide } from '@genny/canvas/snap.ts'
import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'
import type { RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { NodeMedia } from './node-media.tsx'
import { ResizeHandle } from './resize-handle.tsx'
import { useNodeDrag } from './use-node-drag.ts'

type CanvasNodeProps = {
  node: CanvasNodeView
  /** Everything else on the board, asked for when a drag begins. */
  neighbours: () => CanvasNodeView[]
  /**
   * The settled zoom, for choosing which copy of the picture to draw.
   *
   * Settled, not live: it changes once when a gesture ends rather than sixty
   * times during it, which is the whole point of the viewport writing itself.
   * Quality does not need to keep up with a pinch, only to be right after one.
   */
  zoom: number
  /** The live viewport, so a zoom does not have to re-render every node. */
  view: RefObject<Viewport>
  selected: boolean
  /** Space is down, so this drag belongs to the board rather than to the node. */
  panMode: boolean
  onSelect: (additive: boolean) => void
  onInspect: () => void
  /** Raw client coordinates; only the board knows where its own top left is. */
  onContextMenu: (at: { clientX: number; clientY: number }) => void
  onDragStart: () => void
  onMove: (position: { x: number; y: number }) => void
  onCommit: (position: { x: number; y: number }) => void
  onGuides: (guides: Guide[]) => void
  onResize: (size: { width: number; height: number }) => void
  onResizeCommit: (size: { width: number; height: number }) => void
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
  const { node, selected } = props

  const startDrag = useNodeDrag({
    node,
    neighbours: props.neighbours,
    view: props.view,
    selected,
    panMode: props.panMode,
    onSelect: props.onSelect,
    onDragStart: props.onDragStart,
    onMove: props.onMove,
    onCommit: props.onCommit,
    onGuides: props.onGuides,
  })

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
        /*
         * Only when the node itself has focus.
         *
         * The players live inside a node, and a scrubber is a range input: an
         * arrow key on a focused scrubber bubbled up to here, was swallowed,
         * and moved the node across the board instead of moving through the
         * sound. Delete did the same from inside a control.
         */
        if (event.target !== event.currentTarget) return
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
        // Clipped here so everything inside takes the corner: the picture, the
        // player, the failure box and the skeleton, without each one repeating
        // the radius and drifting from the others.
        'overflow-hidden rounded-(--radius-media)',
        'ring-offset-2 ring-offset-surface',
        selected ? 'ring-2 ring-accent' : 'focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <NodeMedia node={node} zoom={props.zoom} />
      <InspectButton node={node} selected={selected} onInspect={props.onInspect} />
      {selected ? (
        <ResizeHandle
          node={node}
          view={props.view}
          onResize={props.onResize}
          onCommit={props.onResizeCommit}
        />
      ) : null}
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
        // 24px of visible button in a 32px target. A 44px circle on the corner
        // of a result covered the result; the padding keeps it thumb-sized
        // without the fill having to be.
        'absolute top-0.5 right-0.5 flex size-8 items-center justify-center p-1',
        'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
        props.selected && 'opacity-100',
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-(--radius-control)',
          'bg-canvas/75 text-ink backdrop-blur',
          'group-focus-within:ring-accent',
        )}
      >
        <Icon name="info" className="size-3.5" />
      </span>
    </button>
  )
}

function describe(node: CanvasNodeView): string {
  if (node.status === 'pending') return 'Generating'
  if (node.status === 'failed') return `Failed: ${node.error ?? 'no reason given'}`
  return `${node.kind ?? 'result'} ${node.label ?? ''}`.trim()
}
