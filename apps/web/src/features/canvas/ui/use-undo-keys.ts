'use client'

import { useEffect } from 'react'

/**
 * Cmd+Z and Shift+Cmd+Z on the board.
 *
 * A window listener rather than a handler on the board, because the board only
 * has focus when a node does and undo has to work after clicking empty space.
 * The bail-out copies the clipboard handler's exactly: inside a text field these
 * belong to the field, and stealing them from the prompt would make undoing a
 * typo delete a picture.
 */
export function useUndoKeys(handlers: { undo: () => void; redo: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return

      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]')) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) handlers.redo()
      else handlers.undo()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers.undo, handlers.redo])
}
