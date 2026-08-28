'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { type Guide, lockAxis, snapTo } from '@genny/canvas/snap.ts'
import type { RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'

/** How close, on screen, counts as lined up. Figma's is about this. */
const SNAP_PIXELS = 6

type DragOptions = {
  node: CanvasNodeView
  /** Asked for once, when the drag begins. */
  neighbours: () => CanvasNodeView[]
  /**
   * The live viewport, read at event time rather than passed as a value.
   *
   * A ref because a zoom must not re-render ninety nodes to tell them a number
   * that only matters while one of them is being dragged.
   */
  view: RefObject<Viewport>
  selected: boolean
  panMode: boolean
  onSelect: (additive: boolean) => void
  onDragStart: () => void
  onMove: (position: { x: number; y: number }) => void
  onCommit: (position: { x: number; y: number }) => void
  onGuides: (guides: Guide[]) => void
}

/**
 * Moving a node: what it snaps to, what shift does, and who else comes along.
 *
 * Lifted out of the component because it is four rules that interact and none
 * of them are about rendering.
 */
export function useNodeDrag(options: DragOptions) {
  const { node, view, selected } = options

  return (event: React.PointerEvent) => {
    // Left button only, and never from inside a media control.
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('video, audio, a, button')) return
    // Space turns the whole board into a pan surface, nodes included.
    if (options.panMode) return
    event.stopPropagation()
    const additive = event.shiftKey || event.metaKey

    /*
     * Pressing something already in the selection does not narrow it. It used
     * to, so grabbing one of three dragged all three and left one of them
     * ringed and the other two looking like they had wandered off on their own.
     *
     * The narrowing happens on release instead, and only if nothing moved,
     * which is what a click on a member of a group means.
     */
    if (additive || !selected) options.onSelect(additive)
    // Announced before the first move, so whoever is tracking the selection can
    // note where all of it started.
    options.onDragStart()

    const neighbours = options.neighbours()
    const origin = { x: event.clientX, y: event.clientY }
    const start = { x: node.x, y: node.y }
    let last = start
    let moved = false

    const move = (dragged: PointerEvent) => {
      const free = {
        x: Math.round(start.x + (dragged.clientX - origin.x) / view.current.zoom),
        y: Math.round(start.y + (dragged.clientY - origin.y) / view.current.zoom),
      }
      // Shift first, then snap: locking after a snap would let an alignment on
      // the abandoned axis drag the node back off the line it is being held to.
      const along = dragged.shiftKey ? lockAxis(start, free) : free
      /*
       * A pixel threshold divided by the zoom. A tolerance in canvas units would
       * get easier to hit the further you zoomed out, which is exactly when
       * someone is placing things roughly and wants to be left alone.
       */
      const snapped = snapTo(
        { ...along, width: node.width, height: node.height },
        neighbours,
        SNAP_PIXELS / view.current.zoom,
      )

      last = snapped.position
      moved = true
      options.onMove(last)
      options.onGuides(snapped.guides)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      options.onGuides([])
      if (moved) options.onCommit(last)
      else if (selected && !additive) options.onSelect(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }
}
