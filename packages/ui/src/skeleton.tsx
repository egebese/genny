import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export type SkeletonProps = {
  /** Reserve the shape the real content will take, so nothing jumps when it lands. */
  aspect?: 'square' | 'video' | 'audio' | 'auto'
  className?: string
  children?: ReactNode
}

const ASPECTS = {
  square: 'aspect-square',
  video: 'aspect-video',
  // Tall enough for a player, short enough not to pretend it is a picture.
  audio: 'h-24',
  auto: '',
} as const

/**
 * A placeholder that holds the right amount of room.
 *
 * The aspect matters more than the shimmer: a square placeholder for a 16:9
 * result means the page reflows the moment the result arrives, which is the
 * layout shift the skeleton was supposed to prevent.
 */
export function Skeleton({ aspect = 'auto', className, children }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex animate-pulse items-center justify-center rounded-(--radius-panel)',
        'border border-line bg-surface px-4 text-center text-ink-faint text-sm',
        ASPECTS[aspect],
        className,
      )}
    >
      {children}
    </div>
  )
}
