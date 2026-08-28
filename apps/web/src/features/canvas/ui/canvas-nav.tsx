'use client'

import { cn } from '@genny/ui/cn.ts'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Two places, because there are only two: the boards you work on and the assets
 * they draw from. The three modality studios are gone; one board holds a still,
 * the clip animated from it and its voiceover, which was the point of dropping
 * them.
 */
const SECTIONS = [
  { href: '/c', label: 'Canvases' },
  { href: '/assets', label: 'Assets' },
] as const

/*
 * Projects have no top-level entry on purpose. `/c` already lists them, each
 * one heading its own boards and linking to itself, so a second way in would
 * be two names for one place.
 */

export function CanvasNav() {
  const pathname = usePathname()
  return (
    <>
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          aria-current={pathname.startsWith(section.href) ? 'page' : undefined}
          className={cn(
            'rounded-(--radius-control) px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
            pathname.startsWith(section.href)
              ? 'bg-surface text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink',
          )}
        >
          {section.label}
        </Link>
      ))}
    </>
  )
}
