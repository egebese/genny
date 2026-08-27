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
        'pt-(--spacing-safe-top)',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">{brand}</div>
        {/* Always visible: with no sidebar, hiding this on a phone would leave
            no navigation at all. It scrolls sideways instead of collapsing.
            min-w-0 is what makes that true: without it the nav refuses to shrink
            and pushes the actions off the edge instead of scrolling. */}
        {nav ? (
          <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 scrollbar-none">
            {nav}
          </nav>
        ) : null}
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  )
}
