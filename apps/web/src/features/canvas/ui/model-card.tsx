'use client'

import { cn } from '@genny/ui/cn.ts'
import type { PickableModel } from '../model-list.ts'

/**
 * One model in the picker, as a 3:2 card.
 *
 * The thumbnail is the whole card rather than a 36px square beside the name:
 * eleven endpoints whose names are all four words of jargon are told apart by
 * what they look like, not by reading each line.
 */
export function ModelCard({ model, current }: { model: PickableModel; current: boolean }) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-2">
      <span
        className={cn(
          'relative block aspect-3/2 w-full overflow-hidden rounded-(--radius-control) bg-canvas',
          current ? 'ring-2 ring-accent' : 'ring-1 ring-line',
        )}
      >
        {model.thumbnailUrl ? (
          // Plain img: these are static cards we generate, or remote thumbnails
          // on a CDN the CSP allows. next/image would add a hop for no gain.
          <img src={model.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}
        {current ? (
          <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">
            <span className="sr-only">Selected</span>✓
          </span>
        ) : null}
      </span>

      {/* Two lines, always. Sharing one with the price left names truncated to
          "E…" at a phone width, which is not a name. */}
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          {model.markUrl ? <img src={model.markUrl} alt="" className="size-3.5 shrink-0" /> : null}
          <span className="truncate font-medium text-ink text-sm" title={model.displayName}>
            {model.displayName}
          </span>
        </span>
        <span className="truncate text-ink-faint text-xs tabular-nums">{model.priceLabel}</span>
      </span>
    </span>
  )
}
