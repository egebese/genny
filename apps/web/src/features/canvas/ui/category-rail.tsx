'use client'

import { cn } from '@genny/ui/cn.ts'

/**
 * The categories down the side of the picker, or across the top on a phone.
 *
 * A category rail plus a grid in 343px leaves no room for either, so the rail
 * becomes a row that scrolls sideways rather than something that collapses.
 */
export function CategoryRail({
  groups,
  chosen,
  onChoose,
}: {
  groups: string[]
  chosen: string | null
  onChoose: (group: string | null) => void
}) {
  return (
    <ul className="flex shrink-0 gap-1 overflow-x-auto border-line border-b p-1 text-sm sm:w-40 sm:flex-col sm:gap-0 sm:overflow-y-auto sm:border-r sm:border-b-0 scrollbar-none">
      <CategoryButton active={chosen === null} onClick={() => onChoose(null)} label="All" />
      {groups.map((name) => (
        <CategoryButton
          key={name}
          active={chosen === name}
          onClick={() => onChoose(name)}
          label={name}
        />
      ))}
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
