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
 * It floats over the feed rather than sitting in a bar across the bottom. A bar
 * cuts the page in two and reads as chrome; a card reads as the thing you are
 * holding. The fade above it is what keeps that legible while results scroll
 * underneath.
 */
export function Dock({ children, className }: DockProps) {
  return (
    <div
      className={cn(
        'pointer-events-none sticky bottom-0 z-10 pb-(--spacing-safe-bottom)',
        className,
      )}
    >
      <div aria-hidden className="h-12 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />
      <div className="bg-canvas pb-3">
        <div className="pointer-events-auto mx-auto w-full max-w-5xl px-4">{children}</div>
      </div>
    </div>
  )
}
