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
 */
export function Dock({ children, className }: DockProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 border-t border-line bg-canvas/90 backdrop-blur',
        'pb-(--spacing-safe-bottom)',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-3">{children}</div>
    </div>
  )
}
