'use client'

import { type RefObject, useCallback, useEffect, useState } from 'react'

/** A pixel of slack, because a scroll position is fractional at some zooms. */
const EDGE = 2

/**
 * Whether a sideways scroller has anything left in either direction.
 *
 * The settings row hides its scrollbar, which is right, and then had no way at
 * all to say that opening the adjust button had put four more controls past the
 * right edge. This is what the arrows are drawn from.
 */
export function useOverflow(ref: RefObject<HTMLElement | null>, watch: unknown) {
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    const max = element.scrollWidth - element.clientWidth
    setEdges({ left: element.scrollLeft > EDGE, right: element.scrollLeft < max - EDGE })
  }, [ref])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    measure()
    element.addEventListener('scroll', measure, { passive: true })
    // Content changes as often as the box does: a different model brings a
    // different number of controls without anything being resized.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [ref, measure])

  // `watch` is the caller's signal that the contents changed: a different model
  // brings a different number of controls without anything being resized.
  useEffect(measure, [measure, watch])

  return edges
}
