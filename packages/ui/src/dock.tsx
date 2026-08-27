import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export type DockProps = {
  children: ReactNode
  className?: string
}

/**
 * The prompt lives here, pinned to the bottom on every screen size. On mobile
 * this is what makes the app feel like an app instead of a page: the thing you
 * came to do is always under your thumb, and nothing has to open on top of it.
 *
 * It floats clear of the surface rather than sitting in a bar. A bar cuts the
 * screen in two and reads as chrome; a card reads as the thing you are holding.
 *
 * There used to be an opaque strip and a fade behind it, from when a feed
 * scrolled underneath. The board does not scroll under anything, and a black bar
 * across the bottom of a canvas hides work for no reason.
 */
export function Dock({ children, className }: DockProps) {
  return (
    <div
      className={cn(
        'pointer-events-none relative z-10 w-full pb-3 pb-(--spacing-safe-bottom)',
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-5xl px-4">{children}</div>
    </div>
  )
}
