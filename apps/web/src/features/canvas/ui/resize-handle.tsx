'use client'

import type { Size, Viewport } from '@genny/canvas/geometry.ts'
import { resizedByStep, resizedTo } from '@genny/canvas/resize.ts'
import type { CanvasNodeView } from '../node-view.ts'

type ResizeHandleProps = {
  node: CanvasNodeView
  viewport: Viewport
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
export function ResizeHandle({ node, viewport, onResize, onCommit }: ResizeHandleProps) {
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
            x: node.x + node.width + (dragged.clientX - origin.x) / viewport.zoom,
            y: node.y + node.height + (dragged.clientY - origin.y) / viewport.zoom,
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
      style={{
        // Constant on screen however far the board is zoomed out, or the handle
        // is a speck at 20% and a slab at 400%.
        width: 14 / viewport.zoom,
        height: 14 / viewport.zoom,
        borderWidth: 2 / viewport.zoom,
        right: -7 / viewport.zoom,
        bottom: -7 / viewport.zoom,
      }}
      className="absolute cursor-nwse-resize rounded-[2px] border-accent bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  )
}
