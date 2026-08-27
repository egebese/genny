'use client'

import { useState } from 'react'
import { cn } from './cn.ts'
import { Icon } from './icon.tsx'

export type CopyButtonProps = {
  value: string
  /** What is being copied, for the label and the announcement. */
  label: string
  className?: string
}

/**
 * Copying is the whole point of showing someone a job id or a payload.
 *
 * An icon, not the word Copy. A details panel has five sections and five copy
 * buttons, and five instances of a word nobody reads is the loudest thing on a
 * panel whose job is showing evidence. The confirmation still lives in the
 * button rather than in a toast, because the answer to "did that work" belongs
 * where the click happened.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
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
    <button
      type="button"
      aria-label={state === 'copied' ? `${label} copied` : `Copy ${label}`}
      onClick={() => void copy()}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-[3px]',
        'outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent',
        state === 'copied' ? 'text-accent' : 'text-ink-faint hover:text-ink',
        className,
      )}
    >
      {state === 'failed' ? (
        <span className="font-mono text-[10px]">\u2318C</span>
      ) : (
        <Icon name={state === 'copied' ? 'check' : 'copy'} className="size-3.5" />
      )}
    </button>
  )
}
