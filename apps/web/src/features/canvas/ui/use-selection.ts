'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { overlaps, type Point, type Rect, rectBetween, toCanvas } from '@genny/canvas/geometry.ts'
import { useCallback, useState } from 'react'
import type { CanvasNodeView } from '../node-view.ts'

/** Below this a drag was a click, and a click on the board clears the selection. */
const DRAG_THRESHOLD = 4

type Options = {
  nodes: CanvasNodeView[]
  viewport: Viewport
  toLocal: (event: { clientX: number; clientY: number }) => Point
}

/**
 * What is selected, and the rubber band that changes it.
 *
 * A set rather than one id: attaching four stills to one edit is the reason the
 * board exists, and picking them one dialog at a time is the thing it replaces.
 */
export function useSelection({ nodes, viewport, toLocal }: Options) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [marquee, setMarquee] = useState<Rect | null>(null)

  const clear = useCallback(() => setSelected(new Set()), [])

  const select = useCallback((id: string, additive: boolean) => {
    setSelected((current) => {
      if (!additive) return new Set([id])
      const next = new Set(current)
      // Additive means toggle: shift-clicking something already picked is how
      // you take it back out without starting the whole selection again.
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const startMarquee = useCallback(
    (event: React.PointerEvent, additive: boolean) => {
      const origin = toLocal(event)
      const base = additive ? new Set(selected) : new Set<string>()
      let moved = false

      const move = (dragged: PointerEvent) => {
        const current = toLocal(dragged)
        const box = rectBetween(origin, current)
        if (!moved && Math.max(box.width, box.height) < DRAG_THRESHOLD) return
        moved = true
        setMarquee(box)

        // Hit-tested in canvas space so the band means the same thing at any zoom.
        const topLeft = toCanvas({ x: box.x, y: box.y }, viewport)
        const inCanvas = {
          ...topLeft,
          width: box.width / viewport.zoom,
          height: box.height / viewport.zoom,
        }
        const next = new Set(base)
        for (const node of nodes) if (overlaps(node, inCanvas)) next.add(node.id)
        setSelected(next)
      }

      const stop = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        setMarquee(null)
        if (!moved && !additive) setSelected(new Set())
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
    },
    [nodes, selected, toLocal, viewport],
  )

  return { selected, marquee, select, clear, setSelected, startMarquee }
}
