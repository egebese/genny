'use client'

import { panToReveal } from '@genny/canvas/flow.ts'
import { fitTo, type Point, type Rect, toCanvas, type Viewport } from '@genny/canvas/geometry.ts'
import { type RefObject, useCallback } from 'react'

type Options = {
  surface: RefObject<HTMLElement | null>
  /** The dock floats over the bottom of the board, so it is not screen to use. */
  dock: RefObject<HTMLElement | null>
  /** The current viewport, read at call time rather than captured. */
  latest: RefObject<Viewport>
  commit: (move: (from: Viewport) => Viewport) => void
}

/**
 * The questions about where things are, as opposed to the gestures that move
 * them.
 *
 * Split out of `useViewport` when it went past the line cap, and the seam was
 * already there: panning and zooming are input, and these four are the board
 * answering "what can be seen and where would this go".
 */
export function useViewGeometry({ surface, dock, latest, commit }: Options) {
  const fit = useCallback(
    (rects: Rect[]) => commit(() => fitTo(rects, sizeOf(surface.current))),
    [surface, commit],
  )

  /** Where a new node should land: the middle of what is currently on screen. */
  const centreOfView = useCallback((): Point => {
    const size = sizeOf(surface.current)
    return toCanvas({ x: size.width / 2, y: size.height / 2 }, latest.current)
  }, [surface, latest])

  /**
   * What is on screen and not behind the dock, in canvas coordinates.
   *
   * The centre alone was enough while a generation just went there. Laying work
   * out in reading order needs the edges too: whether the row has room for one
   * more depends on where the screen ends.
   *
   * The board element runs the full height and the dock floats over its bottom,
   * so the naive answer is too tall by the height of the dock. Work laid out
   * against it lands underneath, and the first thing that went wrong was a
   * resize handle at the corner of a node that turned out to be behind the
   * prompt box: reachable by keyboard, invisible to a pointer.
   */
  const visibleRect = useCallback((): Rect => {
    const size = sizeOf(surface.current)
    const covered = sizeOf(dock.current).height
    return {
      ...toCanvas({ x: 0, y: 0 }, latest.current),
      width: size.width / latest.current.zoom,
      height: Math.max(0, size.height - covered) / latest.current.zoom,
    }
  }, [surface, dock, latest])

  /** Screen coordinates relative to the board, which is what every gesture wants. */
  const toLocal = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = surface.current?.getBoundingClientRect()
      return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
    },
    [surface],
  )

  /**
   * Moves the board just far enough to show `rect`.
   *
   * Work is laid out in reading order, which means the twentieth generation is
   * below the fold. Laid out perfectly somewhere nobody can see is not laid out.
   */
  const reveal = useCallback(
    (rect: Rect) => {
      const by = panToReveal(visibleRect(), rect)
      if (!by) return
      // Canvas units out, screen pixels in: the viewport is a translate.
      commit((current) => ({
        ...current,
        x: current.x - by.x * current.zoom,
        y: current.y - by.y * current.zoom,
      }))
    },
    [visibleRect, commit],
  )

  return { fit, centreOfView, visibleRect, toLocal, reveal }
}

function sizeOf(element: HTMLElement | null) {
  return { width: element?.clientWidth ?? 0, height: element?.clientHeight ?? 0 }
}
