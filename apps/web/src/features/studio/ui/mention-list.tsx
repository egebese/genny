'use client'

import { cn } from '@genny/ui/cn.ts'
import type { AssetView } from '@/features/assets/server/list.ts'

type MentionListProps = {
  candidates: AssetView[]
  highlighted: number
  query: string
  onChoose: (asset: AssetView) => void
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
        No asset matches “{query}”. Upload one on the Assets page.
      </div>
    )
  }

  return (
    <div
      id="mention-list"
      role="listbox"
      aria-label="Assets you can mention"
      className="max-h-56 overflow-y-auto border-line border-b p-1"
    >
      {candidates.map((asset, index) => (
        <div key={asset.id}>
          <button
            type="button"
            id={`mention-option-${asset.id}`}
            role="option"
            aria-selected={index === highlighted}
            // The list must not steal focus from the textarea, and mousedown
            // fires before blur would.
            onMouseDown={(event) => {
              event.preventDefault()
              onChoose(asset)
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-(--radius-control) p-2 text-left',
              index === highlighted ? 'bg-surface-hover' : 'hover:bg-surface-hover',
            )}
          >
            <Thumb asset={asset} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm text-ink">@{asset.label}</span>
              <span className="block text-ink-faint text-xs">{asset.kind}</span>
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}

function Thumb({ asset }: { asset: AssetView }) {
  if (asset.kind !== 'image') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-control) bg-canvas text-ink-faint text-xs">
        {asset.kind === 'video' ? '▶' : '♪'}
      </span>
    )
  }
  return (
    <img
      src={asset.url}
      alt=""
      loading="lazy"
      className="size-8 shrink-0 rounded-(--radius-control) object-cover"
    />
  )
}
