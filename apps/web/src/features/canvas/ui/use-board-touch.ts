'use client'

import type { RefObject } from 'react'
import { nodeIdAt } from './long-press-target.ts'
import { useTouchGestures } from './use-touch-gestures.ts'
import type { useViewport } from './use-viewport.ts'

type Menus = {
  openMenu: (id: string, at: { clientX: number; clientY: number }) => void
  openBoardMenu: (at: { clientX: number; clientY: number }) => void
}

/**
 * Touch, joined up to the two things it needs from the board.
 *
 * A finger could not move this board at all: panning wanted the space bar or a
 * middle button, so one touch on empty space always drew a marquee, and the
 * only zoom was the wheel and the two corner buttons. Nothing reached the
 * context menu either, since iOS never fires `contextmenu`.
 */
export function useBoardTouch(
  surface: RefObject<HTMLDivElement | null>,
  touch: ReturnType<typeof useViewport>['touch'],
  menus: Menus,
) {
  useTouchGestures({
    surface,
    ...touch,
    onLongPress: (target, at) => {
      const where = { clientX: at.x, clientY: at.y }
      const id = nodeIdAt(target)
      if (id) menus.openMenu(id, where)
      else menus.openBoardMenu(where)
    },
  })
}
