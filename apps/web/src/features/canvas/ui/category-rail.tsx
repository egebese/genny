'use client'

import type { MediaKind } from '@genny/models/aspect.ts'
import { cn } from '@genny/ui/cn.ts'

/**
 * The categories down the side of the picker, or across the top on a phone.
 *
 * A category rail plus a grid in 343px leaves no room for either, so the rail
 * becomes a row that scrolls sideways rather than something that collapses.
 */
/** The order the rail reads in, and the heading each category sits under. */
const ORDER: { modality: MediaKind; heading: string }[] = [
  { modality: 'image', heading: 'Images' },
  { modality: 'video', heading: 'Video' },
  { modality: 'audio', heading: 'Audio' },
]

export function CategoryRail({
  groups,
  chosen,
  onChoose,
}: {
  /** Each category and what it makes, so the rail can cluster them. */
  groups: { name: string; modality: MediaKind }[]
  chosen: string | null
  onChoose: (group: string | null) => void
}) {
  return (
    /*
     * Grouped by what comes out. Thirteen categories in one flat column reads
     * as a list to search rather than a shape to scan, and "Editing" means a
     * different thing three rows apart depending on whether the row above it
     * said Image or Video.
     */
    <ul className="flex shrink-0 gap-1 overflow-x-auto border-line border-b p-1 text-sm sm:w-40 sm:flex-col sm:gap-0 sm:overflow-y-auto sm:border-r sm:border-b-0 scrollbar-none">
      <CategoryButton active={chosen === null} onClick={() => onChoose(null)} label="All" />
      {ORDER.map(({ modality, heading }) => {
        const mine = groups.filter((group) => group.modality === modality)
        if (mine.length === 0) return null
        return (
          <li key={modality} className="contents">
            {/* Hidden on a phone, where the rail is a row and a heading in the
                middle of it would read as another category. */}
            <p className="hidden px-2 pt-3 pb-1 font-mono text-[10px] text-ink-faint uppercase tracking-wider sm:block">
              {heading}
            </p>
            {mine.map((group) => (
              <CategoryButton
                key={group.name}
                active={chosen === group.name}
                onClick={() => onChoose(group.name)}
                label={group.name}
              />
            ))}
          </li>
        )
      })}
    </ul>
  )
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'w-full shrink-0 truncate rounded-(--radius-control) px-3 py-1.5 text-left whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
          // Hover one step below the selection rather than at the same token.
          // Both were surface-hover, so the chosen category read as a row
          // somebody's cursor happened to be resting on.
          active
            ? 'bg-surface-hover font-medium text-ink'
            : 'text-ink-muted hover:bg-control hover:text-ink',
        )}
      >
        {label}
      </button>
    </li>
  )
}
