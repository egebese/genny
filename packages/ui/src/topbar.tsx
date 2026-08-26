import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export type TopbarProps = {
  brand: ReactNode
  /** Primary navigation. Kept short on purpose: there is no sidebar to overflow into. */
  nav?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * The only chrome in the product. No sidebar, no drawer: on a phone the topbar
 * stays a topbar and the primary actions live in the bottom dock, where a thumb
 * can actually reach them.
 */
export function Topbar({ brand, nav, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur',
        'pt-[--spacing-safe-top]',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight">{brand}</div>
        {nav ? <nav className="hidden items-center gap-1 sm:flex">{nav}</nav> : null}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  )
}
