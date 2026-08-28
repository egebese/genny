'use client'

import { cn } from '@genny/ui/cn.ts'
import type { MentionableView } from '@/features/assets/server/list.ts'

type MentionListProps = {
  candidates: MentionableView[]
  highlighted: number
  query: string
  onChoose: (item: MentionableView) => void
}

/**
 * Sits above the prompt, in the flow, not in a popover. It is a listbox the
 * textarea points at with aria-activedescendant, so a screen reader hears the
 * options while the caret never leaves the input.
 */
export function MentionList({ candidates, highlighted, query, onChoose }: MentionListProps) {
  if (candidates.length === 0) {
    return (
      <div className="border-line border-b px-4 py-2 text-ink-faint text-sm">
        Nothing matches “{query}”. Upload something on the Assets page.
      </div>
    )
  }

  return (
    <div
      id="mention-list"
      role="listbox"
      aria-label="Assets and groups you can mention"
      className="max-h-56 overflow-y-auto border-line border-b p-1"
    >
      {candidates.map((item, index) => (
        <div key={`${item.kind}-${item.id}`}>
          <button
            type="button"
            id={`mention-option-${item.id}`}
            role="option"
            aria-selected={index === highlighted}
            // The list must not steal focus from the textarea, and mousedown
            // fires before blur would.
            onMouseDown={(event) => {
              event.preventDefault()
              onChoose(item)
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-(--radius-control) p-2 text-left',
              index === highlighted ? 'bg-surface-hover' : 'hover:bg-surface-hover',
            )}
          >
            <Thumb item={item} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-ink text-sm">@{item.label}</span>
              <span className="block text-ink-faint text-xs">
                {item.kind === 'group'
                  ? `character, ${item.count} image${item.count === 1 ? '' : 's'}`
                  : item.media}
              </span>
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}

function Thumb({ item }: { item: MentionableView }) {
  if (!item.previewUrl) {
    return <span className="size-8 shrink-0 rounded-(--radius-media) bg-control" />
  }
  return (
    <img
      src={item.previewUrl}
      alt=""
      loading="lazy"
      className={cn(
        'size-8 shrink-0 object-cover',
        // Characters read as people, so they get the rounder shape.
        item.kind === 'group' ? 'rounded-full' : 'rounded-(--radius-media)',
      )}
    />
  )
}
