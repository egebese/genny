'use client'

import { type Point, type Rect, type Viewport, zoomAt } from '@genny/canvas/geometry.ts'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useSpaceHeld } from './use-space-held.ts'
import { useViewGeometry } from './use-view-geometry.ts'

/**
 * Trackpad deltas are small and continuous; this maps one notch to a step.
 *
 * Doubled from the first guess. At half this a pinch across the whole trackpad
 * barely changed the zoom, so people pinched four times to do one thing.
 */
const WHEEL_ZOOM = 0.005
const KEY_PAN = 80
const SAVE_AFTER_MS = 700

type Options = {
  /** The dock floats over the bottom of the board, so it is not screen to use. */
  dock: RefObject<HTMLDivElement | null>
  initial: Viewport
  surface: RefObject<HTMLElement | null>
  onPersist: (viewport: Viewport) => void
}

/**
 * Pan and zoom for the board.
 *
 * The wheel listener is attached by hand rather than through onWheel because it
 * has to call preventDefault, and React attaches wheel handlers passively:
 * without this, pinching zooms the whole page instead of the canvas.
 */
export function useViewport({ initial, surface, dock, onPersist }: Options) {
  const [viewport, setViewport] = useState<Viewport>(initial)
  const [panning, setPanning] = useState(false)
  const spaceHeld = useSpaceHeld()
  const latest = useRef(viewport)
  latest.current = viewport

  // Debounced, because panning writes on every frame and none of those writes
  // are worth a round trip on their own.
  useEffect(() => {
    const timer = setTimeout(() => onPersist(latest.current), SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [viewport, onPersist])

  useEffect(() => {
    const element = surface.current
    if (!element) return

    function onWheel(event: WheelEvent) {
      /*
       * The overlays render inside the board, so without this the details panel
       * cannot be scrolled: every wheel over it was cancelled here and spent on
       * panning the board underneath instead. Its own content never moved, which
       * is how a panel taller than the room it has ends up with a bottom half
       * nobody can reach.
       */
      if ((event.target as HTMLElement | null)?.closest('[data-overlay]')) return
      event.preventDefault()
      const rect = element?.getBoundingClientRect()
      if (!rect) return
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top }

      // ctrlKey is what a trackpad pinch reports, and what cmd+wheel sends.
      // Everything else is a two finger scroll, which pans.
      setViewport((current) =>
        event.ctrlKey || event.metaKey
          ? zoomAt(current, cursor, Math.exp(-event.deltaY * WHEEL_ZOOM))
          : { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY },
      )
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [surface])

  const startPan = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    const origin = { x: event.clientX, y: event.clientY }
    const start = latest.current
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setPanning(true)

    const move = (moved: PointerEvent) => {
      setViewport({
        ...start,
        x: start.x + (moved.clientX - origin.x),
        y: start.y + (moved.clientY - origin.y),
      })
    }
    const stop = () => {
      setPanning(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }, [])

  const geometry = useViewGeometry({ surface, dock, latest, setViewport })

  /** Keyboard equivalents, so the board is reachable without a pointer at all. */
  const handleKey = useCallback(
    (key: string, rects: Rect[]): boolean => {
      const centre = centreOf(surface.current)
      switch (key) {
        case 'ArrowLeft':
          setViewport((v) => ({ ...v, x: v.x + KEY_PAN }))
          return true
        case 'ArrowRight':
          setViewport((v) => ({ ...v, x: v.x - KEY_PAN }))
          return true
        case 'ArrowUp':
          setViewport((v) => ({ ...v, y: v.y + KEY_PAN }))
          return true
        case 'ArrowDown':
          setViewport((v) => ({ ...v, y: v.y - KEY_PAN }))
          return true
        case '+':
        case '=':
          setViewport((v) => zoomAt(v, centre, 1.2))
          return true
        case '-':
          setViewport((v) => zoomAt(v, centre, 1 / 1.2))
          return true
        case '0':
          geometry.fit(rects)
          return true
        default:
          return false
      }
    },
    [surface, geometry],
  )

  const zoomBy = useCallback(
    (factor: number) => setViewport((v) => zoomAt(v, centreOf(surface.current), factor)),
    [surface],
  )

  return { viewport, panning, spaceHeld, startPan, handleKey, zoomBy, ...geometry }
}

/** The middle of the board in screen pixels, which is what zoom and the arrow
 * keys work from. Not the middle of what is visible: the dock covers part of
 * that, and zooming towards a point behind the prompt box is not what anyone
 * pressing + is asking for. */
function centreOf(element: HTMLElement | null): Point {
  return { x: (element?.clientWidth ?? 0) / 2, y: (element?.clientHeight ?? 0) / 2 }
}
