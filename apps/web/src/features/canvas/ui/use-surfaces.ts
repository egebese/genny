'use client'

import { useCallback, useState } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import type { NodeMenuTarget } from './node-menu.tsx'

/**
 * The two things that can float over the board, and the rule that only one of
 * them ever does.
 *
 * Both describe a specific node, so both have to go the moment the board moves
 * or the selection changes. A menu still pointing at where a node used to be is
 * a menu that acts on the wrong thing.
 */
export function useSurfaces() {
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [menu, setMenu] = useState<NodeMenuTarget | null>(null)

  const clear = useCallback(() => {
    setMenu(null)
    setInspectedId(null)
  }, [])

  const inspect = useCallback((id: string) => {
    setMenu(null)
    // Toggling: the same info button both opens and closes.
    setInspectedId((current) => (current === id ? null : id))
  }, [])

  const openMenu = useCallback((at: { x: number; y: number }, nodes: CanvasNodeView[]) => {
    setInspectedId(null)
    setMenu({ at, nodes })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])
  const closeInspector = useCallback(() => setInspectedId(null), [])

  return { inspectedId, menu, clear, inspect, openMenu, closeMenu, closeInspector }
}
