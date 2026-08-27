'use client'

import { useState } from 'react'
import { Button, type ButtonProps } from './button.tsx'

export type CopyButtonProps = Omit<ButtonProps, 'onClick' | 'children'> & {
  value: string
  /** What is being copied, for the label and the announcement. */
  label: string
}

/**
 * Copying is the whole point of showing someone a job id or a payload, and the
 * product had no clipboard code at all.
 *
 * The confirmation lives in the button rather than in a toast: the answer to
 * "did that work" belongs where the click happened.
 */
export function CopyButton({
  value,
  label,
  tone = 'ghost',
  size = 'sm',
  ...rest
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      // Insecure origins and older browsers have no clipboard object at all.
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <Button
      type="button"
      tone={tone}
      size={size}
      aria-label={state === 'copied' ? `${label} copied` : `Copy ${label}`}
      onClick={() => void copy()}
      {...rest}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Press ⌘C' : 'Copy'}
    </Button>
  )
}
