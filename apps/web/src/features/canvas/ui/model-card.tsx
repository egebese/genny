'use client'

import { cn } from '@genny/ui/cn.ts'
import type { PickableModel } from '../model-list.ts'

/** One per modality, so the grid separates stills from clips before you read it. */
const TINT = {
  image: 'from-[#1b1524]',
  video: 'from-[#101d24]',
  audio: 'from-[#141f12]',
} as const

/**
 * One model in the picker, as a 3:2 card.
 *
 * Composed here rather than drawn into an image. It used to be a generated SVG
 * carrying the art, the mark, the badge and the name, which meant every change
 * to the badge regenerated seventeen files and the text was unreadable at the
 * size the grid draws them. Now the art and the mark are the two files, and
 * everything with an edge you might want to move is CSS.
 */
export function ModelCard({ model, current }: { model: PickableModel; current: boolean }) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-2">
      <span
        className={cn(
          'relative block aspect-3/2 w-full overflow-hidden rounded-(--radius-control)',
          'bg-gradient-to-br to-canvas',
          TINT[model.modality],
          current ? 'ring-2 ring-accent' : 'ring-1 ring-line',
        )}
      >
        {model.artUrl ? (
          <img src={model.artUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}

        {/* Something for the mark to sit on. The art is generated and its
            brightness lands wherever it lands, so a white logo on a pale band is
            one seed away at any time. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(closest-side at 50% 50%, rgb(0 0 0 / 0.55), transparent 78%)',
          }}
        />

        {/* The mark reads as the subject of the card, so it sits where a subject
            goes rather than in a corner with the furniture. */}
        <img
          src={model.markUrl ?? ''}
          alt=""
          loading="lazy"
          className={cn(
            'absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2',
            'drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)]',
            model.markUrl ? '' : 'hidden',
          )}
        />

        <span className="absolute top-2 left-2 rounded-[3px] bg-canvas/70 px-2 py-1 font-mono text-[11px] text-ink uppercase leading-none tracking-wider backdrop-blur">
          {model.group}
        </span>

        {current ? (
          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-[3px] bg-accent text-[11px] text-accent-ink">
            <span className="sr-only">Selected</span>✓
          </span>
        ) : null}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink text-sm" title={model.displayName}>
          {model.displayName}
        </span>
        <span className="truncate text-ink-faint text-xs tabular-nums">{model.priceLabel}</span>
      </span>
    </span>
  )
}
