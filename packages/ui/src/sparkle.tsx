import type { CSSProperties } from 'react'
import { cn } from './cn.ts'

export type SparkleProps = { className?: string; style?: CSSProperties }

/**
 * The four-point glyph the design leans on. Drawn rather than a font character,
 * because the unicode sparkles render as a colour emoji on half the platforms
 * this runs on and there is no way to talk them out of it.
 */
export function Sparkle({ className, style }: SparkleProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      style={style}
      className={cn('size-3', className)}
    >
      <title>decorative sparkle</title>
      {/* Concave sides: a straight-edged star reads as a rating, not a sparkle. */}
      <path
        d="M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12C6.9 10.8 11.4 6.3 12 0Z"
        fill="currentColor"
      />
    </svg>
  )
}
