import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export type FieldProps = {
  /** Stable id: the label points at it and so do the help and error text. */
  id: string
  label: string
  /** Persistent, not a placeholder. A placeholder disappears exactly when needed. */
  help?: string
  error?: string | null
  required?: boolean
  className?: string
  /** Receives the wiring so the control cannot be described by nothing. */
  children: (wiring: {
    id: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
    required: boolean | undefined
  }) => ReactNode
}

/**
 * Label, control, help and error, wired together once.
 *
 * Every form in the app repeated this by hand and each one dropped a different
 * piece: some had no help text, some announced the error to nobody, one had the
 * label only as a placeholder.
 */
export function Field({ id, label, help, error, required, className, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-ink-muted text-sm">
        {label}
        {required ? <span className="ml-1 text-ink-faint">(required)</span> : null}
      </label>

      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        required: required || undefined,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
      {help ? (
        <p id={helpId} className="text-ink-faint text-xs">
          {help}
        </p>
      ) : null}
    </div>
  )
}
