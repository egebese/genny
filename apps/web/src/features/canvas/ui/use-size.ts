'use client'

import { type RefObject, useEffect, useState } from 'react'

export type Size = { width: number; height: number }

/**
 * The rendered size of an element, kept current.
 *
 * Reading `ref.current.clientWidth` during render is null on the first pass and
 * stale after a resize, and both show up as a panel anchored to where the board
 * used to be.
 */
export function useSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
