'use client'

import { ratioOf } from '@genny/models/aspect.ts'
import { SelectChip } from './select-chip.tsx'

/** Drawn to proportion, in a fixed box, so the options compare at a glance. */
function RatioMark({ value }: { value: string }) {
  const ratio = ratioOf(value)
  if (!ratio) {
    // `auto` is a real answer and not a missing one: the model decides.
    return (
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-[2px] border border-ink-faint border-dashed"
      />
    )
  }

  const scale = 16 / Math.max(ratio.width, ratio.height)
  return (
    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
      <span
        className="rounded-[2px] border border-ink-muted"
        style={{
          width: Math.max(4, Math.round(ratio.width * scale)),
          height: Math.max(4, Math.round(ratio.height * scale)),
        }}
      />
    </span>
  )
}

/** `landscape_16_9` is a shape, not a word. Nobody reads it faster than they see it. */
function shortName(value: string): string {
  const ratio = ratioOf(value)
  if (!ratio) return value
  if (/^\d+:\d+$/.test(value)) return value
  const divisor = gcd(ratio.width, ratio.height)
  return `${ratio.width / divisor}:${ratio.height / divisor}`
}

/**
 * The long edge, for the named sizes that carry one.
 *
 * `square_hd` and `square` are both 1:1 and are 1024 and 512 pixels, so a list
 * showing only the ratio offered the same option twice. It also costs a
 * different amount, which is the other reason to say which is which.
 */
function sizeHint(value: string): string | null {
  const ratio = ratioOf(value)
  if (!ratio || /^\d+:\d+$/.test(value)) return null
  return `${Math.max(ratio.width, ratio.height)}`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Aspect ratio, as rectangles.
 *
 * The same control is `aspect_ratio: "16:9"` on one endpoint and
 * `image_size: "landscape_16_9"` on another, and both are a shape. Reading six
 * strings to find the tall one is slower than looking at six rectangles.
 */
export function AspectChip(props: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <SelectChip
      icon="frame"
      label={props.label}
      value={[shortName(props.value), sizeHint(props.value)].filter(Boolean).join(' ')}
      options={props.options}
      onChange={props.onChange}
      render={(option) => (
        <>
          <RatioMark value={option} />
          <span className="truncate">{shortName(option)}</span>
          {sizeHint(option) ? (
            <span className="text-ink-faint tabular-nums">{sizeHint(option)}</span>
          ) : null}
        </>
      )}
    />
  )
}
