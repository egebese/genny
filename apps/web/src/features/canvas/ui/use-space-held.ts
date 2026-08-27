'use client'

import { useEffect, useState } from 'react'

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return (
    element?.tagName === 'TEXTAREA' ||
    element?.tagName === 'INPUT' ||
    element?.isContentEditable === true
  )
}

/**
 * Whether space is down right now.
 *
 * Space is the pan modifier, the way it is in every canvas tool. Plain drag on
 * the board belongs to selection, so panning needs a modifier and this is the
 * one people already have in their hands.
 */
export function useSpaceHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return
      // Otherwise space scrolls the page and presses whatever button has focus.
      event.preventDefault()
      setHeld(true)
    }
    function up(event: KeyboardEvent) {
      if (event.code === 'Space') setHeld(false)
    }
    // A tab away mid-drag leaves the key stuck down otherwise.
    const clear = () => setHeld(false)

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return held
}
