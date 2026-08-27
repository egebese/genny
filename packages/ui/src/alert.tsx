import type { ReactNode } from 'react'
import type { AlertTone } from './alert-tone.ts'
import { cn } from './cn.ts'

export type { AlertTone }

export type AlertProps = {
  tone?: AlertTone
  children: ReactNode
  /** A single way forward. An error with no recovery path is just bad news. */
  action?: ReactNode
  className?: string
}

const TONES: Record<AlertTone, string> = {
  info: 'border-line bg-surface text-ink-muted',
  success: 'border-accent/40 bg-accent/5 text-accent',
  warning: 'border-warning/40 bg-warning/5 text-warning',
  danger: 'border-danger/40 bg-danger/5 text-danger',
}

/**
 * The inline notice every form and panel was hand-rolling.
 *
 * `alert` only for the tones that interrupt: a screen reader stopping mid
 * sentence to read a success message is worse than reading it in order.
 */
export function Alert({ tone = 'info', children, action, className }: AlertProps) {
  const interrupts = tone === 'danger' || tone === 'warning'

  return (
    <div
      role={interrupts ? 'alert' : 'status'}
      aria-live={interrupts ? 'assertive' : 'polite'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-(--radius-control) border px-3 py-2 text-sm',
        TONES[tone],
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}
