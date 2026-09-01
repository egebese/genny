'use client'

import { cn } from '@genny/ui/cn.ts'

/**
 * The bar you drag to move through a clip or a sound.
 *
 * A range input, restyled, rather than a div with pointer handlers: the arrow
 * keys, Home and End, and every screen reader already know what this is, and
 * none of that is worth rewriting for a bar.
 *
 * What the browser gives you is a plain grey rail and an oversized thumb in the
 * platform's own colour, so a board of three sounds had three white circles
 * floating on nothing and no way to see how far in you were except by where the
 * circle sat. The played part is filled here, which is the whole point of the
 * shape, and the thumb is small enough to belong to a three pixel rail.
 */
export function MediaScrubber({
  at,
  length,
  onSeek,
  className,
}: {
  at: number
  length: number
  onSeek: (to: number) => void
  className?: string
}) {
  const played = length > 0 ? Math.min(100, (at / length) * 100) : 0

  return (
    <input
      type="range"
      min={0}
      max={Math.max(length, 0.01)}
      step={0.01}
      value={at}
      aria-label="Seek"
      aria-valuetext={`${clock(at)} of ${clock(length)}`}
      onChange={(event) => onSeek(Number(event.target.value))}
      style={{
        // The fill is the background, so there is one element rather than a
        // rail, a fill and a thumb stacked and kept in step by hand.
        backgroundImage: `linear-gradient(to right, var(--color-accent) ${played}%, color-mix(in oklab, var(--color-ink) 22%, transparent) ${played}%)`,
      }}
      className={cn(
        'h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-transparent outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        // Both engines, because neither reads the other's pseudo-element and a
        // thumb styled for one is the browser default in the other.
        '[&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink',
        '[&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125',
        '[&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:appearance-none',
        '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink',
        className,
      )}
    />
  )
}

/** Minutes and seconds. Anything longer than an hour is not a generation. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
