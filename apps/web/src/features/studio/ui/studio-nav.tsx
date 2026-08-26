'use client'

import { cn } from '@genny/ui/cn.ts'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Every modality is a route, not a tab inside one page. That keeps the URL
 * shareable, the back button honest, and each studio's code in its own segment.
 */
const SECTIONS = [
  { href: '/image', label: 'Image' },
  { href: '/video', label: 'Video' },
  { href: '/audio', label: 'Audio' },
  { href: '/assets', label: 'Assets' },
] as const

export function StudioNav() {
  const pathname = usePathname()
  return (
    <>
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          aria-current={pathname.startsWith(section.href) ? 'page' : undefined}
          className={cn(
            'rounded-(--radius-control) px-3 py-1.5 text-sm transition-colors',
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
