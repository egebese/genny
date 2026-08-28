'use client'

import { useEffect } from 'react'

/**
 * Swallows the browser's own right-click menu, everywhere.
 *
 * The studio is an app, not a document. Right-clicking a result offered to save
 * the image, open it in a new tab and search the web for it, which are three
 * answers to questions the node menu already answers better, and right-clicking
 * anywhere else offered to reload the page in the middle of a drag.
 *
 * On the document rather than on the board, so it also covers the topbar, the
 * dock and the library. React's own listeners sit on the root container, below
 * this one, so a right-click still reaches the node menu on its way past.
 */
export function NoContextMenu() {
  useEffect(() => {
    const swallow = (event: MouseEvent) => event.preventDefault()
    document.addEventListener('contextmenu', swallow)
    return () => document.removeEventListener('contextmenu', swallow)
  }, [])
  return null
}
