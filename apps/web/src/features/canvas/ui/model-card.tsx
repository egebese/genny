'use client'

import { cn } from '@genny/ui/cn.ts'
import type { PickableFamily } from '../family-list.ts'

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
export function ModelCard({
  model,
  current,
  group,
}: {
  model: PickableFamily
  current: boolean
  /** The category being browsed, when one is. Defaults to its plainest task. */
  group?: string
}) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-2">
      <span
        className={cn(
          'relative block aspect-3/2 w-full overflow-hidden rounded-(--radius-control)',
          'bg-gradient-to-br to-canvas',
          TINT[model.modality],
          // One pixel, and only the ring: a 2px accent border plus a filled
          // accent badge made the chosen card the most saturated thing in a
          // panel whose whole job is showing generated art. Same width either
          // way, so choosing one does not nudge the grid.
          current ? 'ring-1 ring-accent' : 'ring-1 ring-line',
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
          {group ?? model.group}
        </span>

        {/*
          What it does with something handed to it.
          
          The group only says what the model does from a prompt alone, because
          that is the endpoint the picker is choosing. Four video families also
          animate a still, and with nothing to say so the picker looked like it
          had no image-to-video at all: the endpoint that does it exists, and
          the way you reach it is to attach an image, which is not a thing you
          try on a card that says Text to Video.
        */}
        {model.accepts.length > 0 ? (
          <span className="absolute bottom-2 left-2 rounded-[3px] bg-canvas/70 px-2 py-1 font-mono text-[11px] text-ink-muted uppercase leading-none tracking-wider backdrop-blur">
            + {model.accepts.join(' / ')}
          </span>
        ) : null}

        {current ? (
          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-[3px] bg-canvas/80 text-[11px] text-accent leading-none ring-1 ring-accent/50 backdrop-blur">
            <span className="sr-only">Selected</span>✓
          </span>
        ) : null}
      </span>

      <span className="flex min-w-0 flex-col">
        <span
          className={cn('truncate font-medium text-sm', current ? 'text-accent' : 'text-ink')}
          title={model.name}
        >
          {model.name}
        </span>
        <span className="truncate text-ink-faint text-xs tabular-nums">{model.priceLabel}</span>
      </span>
    </span>
  )
}
