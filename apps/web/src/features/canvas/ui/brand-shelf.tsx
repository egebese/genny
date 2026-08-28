'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'
import Link from 'next/link'
import { useState } from 'react'
import type { BrandItemView } from '../server/canvas-page.ts'

const GROUPS = [
  { role: 'logo', label: 'Logo' },
  { role: 'product', label: 'Product' },
  { role: 'reference', label: 'Reference' },
] as const

type ShelfProps = {
  projectId: string
  projectTitle: string
  items: BrandItemView[]
  palette: string[]
  onAttach: (item: BrandItemView) => void
}

/**
 * The project's own material, pinned to the board.
 *
 * Not a sidebar and not a modal: it floats in screen space over the canvas, the
 * way the node panel does, and everything behind it stays live. It is the one
 * floating surface that is allowed to persist, because unlike the menu and the
 * detail panel it is not about a particular node, so nothing about it goes
 * stale when the board moves.
 *
 * Collapsed by default on a phone. Open, it takes about a third of a 375px
 * board, and the board is the thing they came for.
 */
export function BrandShelf({ projectId, projectTitle, items, palette, onAttach }: ShelfProps) {
  const [open, setOpen] = useState(false)
  const empty = items.length === 0 && palette.length === 0

  return (
    <aside
      data-overlay
      aria-label="Project material"
      className="panel pointer-events-auto absolute top-4 left-4 z-20 flex max-w-[min(18rem,calc(100%-2rem))] flex-col overflow-hidden rounded-(--radius-panel)"
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon
          name="chevron"
          // The glyph points down, so closed turns it right and open leaves it
          // alone. Rotating the other way pointed it back at the edge it is
          // pinned to, which reads as "go back" rather than "open this".
          className={cn(
            'size-3.5 shrink-0 text-ink-faint transition-transform',
            open ? '' : '-rotate-90',
          )}
        />
        <span className="truncate font-mono text-[10px] text-ink-faint uppercase tracking-wider">
          {projectTitle}
        </span>
      </button>

      {open ? (
        <div className="flex max-h-[min(26rem,55dvh)] flex-col gap-3 overflow-y-auto border-line border-t p-3">
          {empty ? (
            <p className="text-ink-faint text-xs">
              Nothing pinned yet.{' '}
              <Link href={`/p/${projectId}`} className="text-ink underline underline-offset-2">
                Add the logo, the products and the colours
              </Link>{' '}
              and they follow you onto every board in this project.
            </p>
          ) : null}

          {palette.length > 0 ? (
            <section>
              <Heading>Palette</Heading>
              <ul className="flex flex-wrap gap-1.5">
                {palette.map((colour) => (
                  <li key={colour}>
                    <span
                      title={colour}
                      className="block size-6 rounded-[3px] ring-1 ring-line"
                      style={{ background: colour }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {GROUPS.map(({ role, label }) => {
            const group = items.filter((item) => item.role === role)
            if (group.length === 0) return null
            return (
              <section key={role}>
                <Heading>{label}</Heading>
                <ul className="grid grid-cols-4 gap-1.5">
                  {group.map((item) => (
                    <li key={item.assetId}>
                      <button
                        type="button"
                        onClick={() => onAttach(item)}
                        // Named explicitly, and the thumbnail left decorative.
                        // A button whose only content is an image takes its
                        // name from that image, so this one announced itself as
                        // the filename rather than as something that does
                        // anything.
                        aria-label={`Attach ${item.label}`}
                        title={`Attach @${item.label}`}
                        className="block aspect-square w-full overflow-hidden rounded-[3px] bg-surface outline-none ring-1 ring-line hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {item.kind === 'image' ? (
                          <img src={item.url} alt="" className="size-full object-cover" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : null}
    </aside>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1.5 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
      {children}
    </h2>
  )
}
