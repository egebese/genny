'use client'

import { useState } from 'react'
import { Button } from './button.tsx'

export type ConfirmInlineProps = {
  /** The resting label, e.g. "Delete". */
  label: string
  /** The question, e.g. "Delete this character?". Read aloud when armed. */
  question: string
  confirmLabel?: string
  pending?: boolean
  onConfirm: () => void
  className?: string
}

/**
 * A confirmation with no dialog: the control becomes the question.
 *
 * This product has no modals, so the alternative to a confirm dialog is either
 * an inline step like this or an undo afterwards. Destructive actions that can
 * be undone should prefer the undo; ones that cannot come here.
 */
export function ConfirmInline({
  label,
  question,
  confirmLabel = 'Yes, delete',
  pending,
  onConfirm,
  className,
}: ConfirmInlineProps) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <Button
        type="button"
        tone="ghost"
        size="sm"
        className={className}
        onClick={() => setArmed(true)}
      >
        {label}
      </Button>
    )
  }

  return (
    <span className={className}>
      <span role="alert" className="mr-2 text-ink-muted text-sm">
        {question}
      </span>
      {/* Spread rather than pass undefined: exactOptionalPropertyTypes tells
          "absent" and "present and undefined" apart. */}
      <Button
        type="button"
        tone="danger"
        size="sm"
        {...(pending === undefined ? {} : { pending })}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  )
}
