'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { distance, midpoint, pinchViewport } from '@genny/canvas/pinch.ts'
import { type RefObject, useEffect, useRef } from 'react'
import { TOUCH_SLOP } from './slop.ts'

/** Long enough not to fire while somebody is deciding, short enough to feel deliberate. */
const LONG_PRESS_MS = 450
/** After a long press fires, ignore the release and any contextmenu behind it. */
const SUPPRESS_MS = 700

type Point = { x: number; y: number }

type Options = {
  surface: RefObject<HTMLDivElement | null>
  /** The viewport of record. `glide` writes the DOM now and React later. */
  latest: RefObject<Viewport>
  glide: (next: (current: Viewport) => Viewport) => void
  setPanning: (panning: boolean) => void
  onLongPress: (target: EventTarget | null, at: Point) => void
}

/**
 * Everything a finger can do to the board.
 *
 * The board sets `touch-action: none`, which is kept: relaxing it hands the
 * gesture to the browser and we stop receiving `pointermove` partway through,
 * so a pinch would fight the page's own zoom. Everything is synthesised from
 * `PointerEvent`s instead, which is also what makes it testable without real
 * multi-touch hardware.
 *
 * Before this a phone could not move the board at all: pan needed the space bar
 * or a middle button, so one finger on empty board always drew a marquee, and
 * zoom existed only on the wheel and the two corner buttons.
 *
 * The listener is on the **capture** phase deliberately. `use-node-drag` calls
 * `stopPropagation`, so a bubble-phase listener never sees the first finger when
 * it lands on a node, and a pinch that starts over a picture would be invisible.
 *
 * Only `pointerType === 'touch'` is handled. Mouse and pen keep the existing
 * path exactly, so nothing about desktop behaviour or the measured zoom cost
 * changes.
 */
export function useTouchGestures(options: Options) {
  const held = useRef(options)
  held.current = options

  useEffect(() => {
    const element = options.surface.current
    if (!element) return

    const pointers = new Map<number, Point>()
    let base: { viewport: Viewport; gap: number; from: Point } | null = null
    let press: { id: number; at: Point; target: EventTarget | null; timer: number } | null = null
    let suppressUntil = 0
    /*
     * Whether the finger came down on empty board. A press that landed on a
     * node belongs to the node's own drag, and panning as well would move the
     * board out from under the thing being moved.
     */
    let onEmptyBoard = false

    const local = (event: PointerEvent): Point => {
      const rect = element.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const cancelPress = () => {
      if (!press) return
      clearTimeout(press.timer)
      press = null
    }

    /*
     * Takes the gesture away from whatever else is tracking it. Node drag,
     * board pan and the marquee all bind `pointercancel` to their own stop, so
     * one synthetic event ends whichever is running without a registry of them.
     */
    const stealGesture = () => {
      window.dispatchEvent(new PointerEvent('pointercancel'))
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType !== 'touch') return
      pointers.set(event.pointerId, local(event))

      if (pointers.size === 2) {
        cancelPress()
        stealGesture()
        const [a, b] = [...pointers.values()]
        if (!a || !b) return
        base = { viewport: held.current.latest.current, gap: distance(a, b), from: midpoint(a, b) }
        held.current.setPanning(true)
        return
      }

      if (pointers.size !== 1) return
      onEmptyBoard =
        !(event.target instanceof HTMLElement) ||
        event.target.closest('[role="option"], [data-overlay]') === null

      // iOS never fires `contextmenu`, and globals.css already suppresses the
      // save-image callout, so the long press is synthesised here or the menu
      // is unreachable on a phone entirely.
      const at = { x: event.clientX, y: event.clientY }
      press = {
        id: event.pointerId,
        at,
        target: event.target,
        timer: window.setTimeout(() => {
          suppressUntil = Date.now() + SUPPRESS_MS
          stealGesture()
          held.current.onLongPress(press?.target ?? null, at)
          press = null
        }, LONG_PRESS_MS),
      }
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return
      const previous = pointers.get(event.pointerId)
      pointers.set(event.pointerId, local(event))

      if (press?.id === event.pointerId) {
        const travelled = Math.hypot(event.clientX - press.at.x, event.clientY - press.at.y)
        if (travelled > TOUCH_SLOP) cancelPress()
      }

      if (pointers.size === 2 && base) {
        const [a, b] = [...pointers.values()]
        if (!a || !b) return
        const gap = distance(a, b)
        // Recomputed from the base every frame, never compounded, so a long
        // pinch cannot drift and pinching back lands exactly where it started.
        const seed = base
        held.current.glide(() =>
          pinchViewport(seed.viewport, seed.from, midpoint(a, b), gap / seed.gap),
        )
        return
      }

      // One finger on empty board pans. There is no touch marquee: tap and
      // tap-additive is how a selection is built on a phone, and a finger drag
      // that drew a rubber band would leave the board immovable.
      if (pointers.size === 1 && previous && !press && onEmptyBoard) {
        const now = pointers.get(event.pointerId)
        if (!now) return
        held.current.glide((current) => ({
          ...current,
          x: current.x + (now.x - previous.x),
          y: current.y + (now.y - previous.y),
        }))
      }
    }

    function onUp(event: PointerEvent) {
      if (event.pointerType !== 'touch') return
      pointers.delete(event.pointerId)
      if (press?.id === event.pointerId) cancelPress()

      // Dropping to one finger ends the pinch. The pan that may follow works
      // from that pointer's own previous position, so there is nothing to
      // re-seed: a second finger coming back down starts a fresh base.
      if (pointers.size < 2) {
        base = null
        held.current.setPanning(false)
      }
    }

    // Android does fire this, so without the window the menu opens twice.
    function onContextMenu(event: Event) {
      if (Date.now() < suppressUntil) event.preventDefault()
    }

    element.addEventListener('pointerdown', onDown, { capture: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    element.addEventListener('contextmenu', onContextMenu)

    return () => {
      element.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      element.removeEventListener('contextmenu', onContextMenu)
    }
  }, [options.surface])
}
