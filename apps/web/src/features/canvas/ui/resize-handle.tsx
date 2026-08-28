'use client'

import type { Size, Viewport } from '@genny/canvas/geometry.ts'
import { resizedByStep, resizedTo } from '@genny/canvas/resize.ts'
import type { RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'

type ResizeHandleProps = {
  node: CanvasNodeView
  /** The live viewport, read at event time. A zoom must not re-render nodes. */
  view: RefObject<Viewport>
  onResize: (size: Size) => void
  onCommit: (size: Size) => void
}

/**
 * The corner you drag to change how big a node is.
 *
 * A button rather than a bare div, and it takes the arrow keys, because a
 * handle you can only reach with a pointer is a feature that does not exist for
 * anyone using a keyboard. Left and up shrink, right and down grow, one quarter
 * of the default size at a time.
 *
 * Only on a selected node. A handle on every node is forty handles on a board
 * of forty, all of them one pixel from something you meant to drag.
 */
export function ResizeHandle({ node, view, onResize, onCommit }: ResizeHandleProps) {
  return (
    <button
      type="button"
      aria-label={`Resize ${node.label ?? 'result'}`}
      onPointerDown={(event) => {
        // The board is listening for a drag on the node underneath, and a
        // resize is not a move.
        event.preventDefault()
        event.stopPropagation()

        /*
         * On the window, not on the handle with `setPointerCapture`. Capture is
         * the tidier idea and it does not deliver here: the moves never reached
         * the listener in a production build, so the corner could be grabbed
         * and dragged and nothing happened. Every other drag on this board
         * listens on the window; this one does now too.
         */
        const origin = { x: event.clientX, y: event.clientY }
        let last = { width: node.width, height: node.height }

        const move = (dragged: PointerEvent) => {
          // Canvas units, not screen pixels: at 40% zoom a hundred pixels of
          // pointer is two hundred and fifty units of node.
          last = resizedTo(node, {
            x: node.x + node.width + (dragged.clientX - origin.x) / view.current.zoom,
            y: node.y + node.height + (dragged.clientY - origin.y) / view.current.zoom,
          })
          onResize(last)
        }
        const stop = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', stop)
          window.removeEventListener('pointercancel', stop)
          onCommit(last)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop)
        window.addEventListener('pointercancel', stop)
      }}
      onKeyDown={(event) => {
        const steps: Record<string, number> = {
          ArrowRight: 1,
          ArrowDown: 1,
          ArrowLeft: -1,
          ArrowUp: -1,
        }
        const step = steps[event.key]
        if (step === undefined) return
        event.preventDefault()
        // Stopped, or the node behind it reads the same key as a nudge and the
        // thing moves while it grows.
        event.stopPropagation()
        onCommit(resizedByStep(node, step))
      }}
      /*
       * Scales with the board, like everything else on it.
       *
       * A handle that stays the same size on screen is the nicer answer and it
       * costs a re-render of every node on every frame of a pinch, or an
       * inherited custom property that invalidates their style instead. Neither
       * is worth it for a control you reach for at a zoom where you can already
       * see the node you are resizing.
       */
      style={{ width: 14, height: 14, borderWidth: 2, right: -7, bottom: -7 }}
      className="absolute cursor-nwse-resize rounded-[2px] border-accent bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  )
}
