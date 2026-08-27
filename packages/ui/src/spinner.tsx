import { cn } from './cn.ts'

export type SpinnerProps = { className?: string; label?: string }

/**
 * A pending indicator, not a loading screen. Decorative by default: a button
 * that already says "Sending" does not need this announced twice, and a
 * duplicate announcement is worse than none.
 */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn('size-4 animate-spin', className)}
    >
      {label ? <title>{label}</title> : null}
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      {/* A quarter arc: the gap is what makes the rotation legible. */}
      <path
        d="M8 2a6 6 0 0 1 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
