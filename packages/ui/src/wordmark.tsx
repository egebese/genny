import { cn } from './cn.ts'
import { Sparkle } from './sparkle.tsx'

export type WordmarkProps = { className?: string }

/**
 * Plain white. There was an iridescent gradient here; everywhere else it
 * is a one pixel edge or a single button, so that the only saturated thing on a
 * black page is the media someone made.
 *
 * The glyph beside it is plain white: the gradient works by clipping a
 * background to text, and an svg painted with currentColor under that rule is
 * painted with transparent.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <span className="font-semibold text-ink text-lg lowercase tracking-[-0.02em]">genny</span>
      <Sparkle className="size-2.5 self-start text-ink" />
    </span>
  )
}
