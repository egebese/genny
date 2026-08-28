'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Matches the dot grid drawn on the surface. */
const GRID = 32

const SAVE_AFTER_MS = 700

/**
 * How long after the last wheel or drag frame React is told where the board is.
 *
 * Short enough that anything reading the viewport is never stale for long, long
 * enough that a whole pinch is one render rather than sixty.
 */
const SETTLE_MS = 120

/** Everything a zoom actually changes, which is less than it looks. */
export type Painted = {
  /** Draws the dot grid, which has to keep up with the transform. */
  surface: RefObject<HTMLElement | null>
  /** The transformed layer. */
  layer: RefObject<HTMLElement | null>
  /** The percentage on the zoom control, which is the one number worth writing. */
  readout: RefObject<HTMLElement | null>
}

type Options = Painted & {
  initial: Viewport
  onPersist: (viewport: Viewport) => void
}

/**
 * Where the board is, and how that gets written.
 *
 * `latest` is the viewport; the state is a mirror of it kept so React can
 * render. They used to be the other way round, and then a wheel event could not
 * move the board without going through React, which meant reconciling every
 * node on it to change one transform on their shared parent.
 *
 * Two ways to move it, and the difference is what the move is. A gesture
 * `glide`s: the transform is written now and React is told once the gesture
 * settles. Everything else `commit`s, because a keypress or a fit is one render
 * and deferring it would only make it feel late.
 */
export function useViewportState({ initial, onPersist, ...painted }: Options) {
  const [viewport, setViewport] = useState<Viewport>(initial)
  const latest = useRef(viewport)
  const settling = useRef<ReturnType<typeof setTimeout>>(undefined)

  const glide = useCallback(
    (move: (from: Viewport) => Viewport) => {
      latest.current = move(latest.current)
      applyViewport(painted, latest.current)
      clearTimeout(settling.current)
      settling.current = setTimeout(() => setViewport(latest.current), SETTLE_MS)
    },
    [painted],
  )

  const commit = useCallback(
    (move: (from: Viewport) => Viewport) => {
      clearTimeout(settling.current)
      latest.current = move(latest.current)
      applyViewport(painted, latest.current)
      setViewport(latest.current)
    },
    [painted],
  )

  /*
   * Re-asserted after every render, because a render caused by something else
   * mid-gesture would otherwise paint the viewport React last heard about and
   * jump the board back to it.
   */
  useLayoutEffect(() => {
    applyViewport(painted, latest.current)
  })

  // Debounced, because panning writes on every frame and none of those writes
  // are worth a round trip on their own.
  useEffect(() => {
    const timer = setTimeout(() => onPersist(latest.current), SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [viewport, onPersist])

  return { viewport, latest, glide, commit }
}

/**
 * Writes a viewport onto the board.
 *
 * Imperative on purpose, and the reason is what a zoom actually is: a transform
 * on one element, a background that follows it, and a number in a corner.
 * Everything else the board does at that moment is waste, and going through
 * React state meant reconciling every node on it to change those three things.
 *
 * Plain properties, not custom ones. Writing `--zoom` on the surface and
 * dividing by it in CSS further down reads better and costs far more: an
 * inherited custom property invalidates style for the whole subtree, so a pinch
 * over ninety nodes traded thirty-eight milliseconds of scripting for eighty of
 * style recalculation. Nothing below the surface needs to know the zoom.
 */
function applyViewport(painted: Painted, viewport: Viewport): void {
  const surface = painted.surface.current
  if (surface) {
    const step = `${GRID * viewport.zoom}px`
    surface.style.backgroundSize = `${step} ${step}`
    surface.style.backgroundPosition = `${viewport.x}px ${viewport.y}px`
  }
  const layer = painted.layer.current
  if (layer) {
    layer.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
  }
  const readout = painted.readout.current
  if (readout) readout.textContent = `${Math.round(viewport.zoom * 100)}%`
}
