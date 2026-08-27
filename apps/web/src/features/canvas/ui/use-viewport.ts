'use client'

import {
  fitTo,
  type Point,
  type Rect,
  toCanvas,
  type Viewport,
  zoomAt,
} from '@genny/canvas/geometry.ts'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useSpaceHeld } from './use-space-held.ts'

/** Trackpad deltas are small and continuous; this maps one notch to a sane step. */
const WHEEL_ZOOM = 0.0025
const KEY_PAN = 80
const SAVE_AFTER_MS = 700

type Options = {
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
export function useViewport({ initial, surface, onPersist }: Options) {
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
          setViewport(fitTo(rects, sizeOf(surface.current)))
          return true
        default:
          return false
      }
    },
    [surface],
  )

  const zoomBy = useCallback(
    (factor: number) => setViewport((v) => zoomAt(v, centreOf(surface.current), factor)),
    [surface],
  )

  const fit = useCallback(
    (rects: Rect[]) => setViewport(fitTo(rects, sizeOf(surface.current))),
    [surface],
  )

  /** Where a new node should land: the middle of what is currently on screen. */
  const centreOfView = useCallback((): Point => {
    const centre = centreOf(surface.current)
    return toCanvas(centre, latest.current)
  }, [surface])

  /** Screen coordinates relative to the board, which is what every gesture wants. */
  const toLocal = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = surface.current?.getBoundingClientRect()
      return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
    },
    [surface],
  )

  return {
    viewport,
    panning,
    spaceHeld,
    startPan,
    handleKey,
    zoomBy,
    fit,
    centreOfView,
    toLocal,
  }
}

function sizeOf(element: HTMLElement | null) {
  return { width: element?.clientWidth ?? 0, height: element?.clientHeight ?? 0 }
}

function centreOf(element: HTMLElement | null): Point {
  const size = sizeOf(element)
  return { x: size.width / 2, y: size.height / 2 }
}
