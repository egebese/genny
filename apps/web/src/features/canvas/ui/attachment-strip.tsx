'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'

export type Attachment = {
  field: string
  assetId: string
  slotLabel: string
  label: string
  url: string
  kind: 'image' | 'video' | 'audio'
}

/** A handle the prompt names, resolved to something we can show. */
export type MentionChip = {
  label: string
  previewUrl: string | null
  count: number
}

type StripProps = {
  attachments: Attachment[]
  mentions: MentionChip[]
  onRemove: (index: number) => void
  /** Takes the handle back out of the prompt text, which is where it lives. */
  onUnmention: (label: string) => void
}

/**
 * What this generation is carrying, above the prompt.
 *
 * Two kinds of chip that look the same on purpose. A pinned attachment goes to a
 * named input and says which one; a mention is part of the sentence and says its
 * handle. They arrive by different routes and they are both an image this
 * generation will see, so showing one as a thumbnail and the other as bare text
 * in the prompt made the second look like a typo.
 */
export function AttachmentStrip({ attachments, mentions, onRemove, onUnmention }: StripProps) {
  if (attachments.length === 0 && mentions.length === 0) return null

  return (
    <ul
      aria-label="Attached to this generation"
      className="flex flex-wrap gap-1.5 border-line border-b px-3 py-2"
    >
      {attachments.map((attachment, index) => (
        <Chip
          key={`${attachment.field}:${attachment.assetId}:${index}`}
          tag={attachment.slotLabel.replace(/^Use as /, '').replace(/^./, (c) => c.toUpperCase())}
          name={attachment.label}
          preview={attachment.kind === 'image' ? attachment.url : null}
          fallback={attachment.kind}
          onRemove={() => onRemove(index)}
        />
      ))}

      {mentions.map((mention) => (
        <Chip
          key={`@${mention.label}`}
          tag={`@${mention.label}`}
          name={mention.count > 1 ? `${mention.count} images` : 'mentioned'}
          preview={mention.previewUrl}
          fallback={mention.count > 1 ? `${mention.count}` : '@'}
          onRemove={() => onUnmention(mention.label)}
        />
      ))}
    </ul>
  )
}

/**
 * The preview leads, then what this is for, then what it is.
 *
 * Two lines rather than one: "Start frame" and the handle answer different
 * questions, and running them together as `START FRAME a-smooth-river-…` made
 * the part that matters, which of two image slots this fills, the part that got
 * truncated first.
 */
function Chip(props: {
  tag: string
  name: string
  preview: string | null
  fallback: string | null
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-(--radius-control) bg-control py-1 pr-1 pl-1">
      {props.preview ? (
        <img src={props.preview} alt="" className="size-8 rounded-(--radius-media) object-cover" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-(--radius-media) bg-canvas font-mono text-[10px] text-ink-faint">
          {props.fallback}
        </span>
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-ink text-xs">{props.tag}</span>
        <span className="max-w-32 truncate text-[11px] text-ink-faint">{props.name}</span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${props.name}`}
        onClick={props.onRemove}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-[3px] text-ink-faint',
          'outline-none hover:bg-surface-hover hover:text-ink',
          'focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <Icon name="close" className="size-3.5" />
      </button>
    </li>
  )
}
