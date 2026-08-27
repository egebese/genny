'use client'

import { cn } from '@genny/ui/cn.ts'

export type Attachment = {
  field: string
  assetId: string
  slotLabel: string
  label: string
  url: string
  kind: 'image' | 'video' | 'audio'
}

/**
 * What is pinned to a named input, above the prompt.
 *
 * Separate from `@mentions` on purpose: a mention is part of the sentence and
 * reads in it, and these are not. A start frame is not something you say, it is
 * something you hand over, and the dock has to show you what it is holding.
 */
export function AttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: Attachment[]
  onRemove: (index: number) => void
}) {
  if (attachments.length === 0) return null

  return (
    <ul
      aria-label="Attached to this generation"
      className="flex flex-wrap gap-1.5 border-line border-b px-3 py-2"
    >
      {attachments.map((attachment, index) => (
        <li
          key={`${attachment.field}:${attachment.assetId}:${index}`}
          className="flex items-center gap-2 rounded-(--radius-control) border border-line bg-surface py-1 pr-1 pl-2"
        >
          <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
            {attachment.slotLabel}
          </span>
          {attachment.kind === 'image' ? (
            <img src={attachment.url} alt="" className="size-6 rounded object-cover" />
          ) : (
            <span className="text-ink-muted text-xs">{attachment.kind}</span>
          )}
          <span className="max-w-24 truncate text-ink text-xs">{attachment.label}</span>
          <button
            type="button"
            aria-label={`Remove ${attachment.label} from ${attachment.slotLabel}`}
            onClick={() => onRemove(index)}
            className={cn(
              'flex size-6 items-center justify-center rounded text-ink-faint',
              'outline-none hover:bg-surface-hover hover:text-ink',
              'focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
