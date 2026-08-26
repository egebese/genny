'use client'

import { estimateUnits } from '@genny/models/credits.ts'
import { Button } from '@genny/ui/button.tsx'
import { useMemo, useRef, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import { ModelPicker } from './model-picker.tsx'
import { SettingField } from './setting-field.tsx'

type PromptDockProps = {
  models: PickableModel[]
  model: PickableModel
  onModelChange: (model: PickableModel) => void
  settings: Record<string, unknown>
  onSettingChange: (name: string, value: unknown) => void
  pending: boolean
  error: string | null
  onSubmit: (prompt: string) => void
}

const MAX_ROWS = 6

/** Sub-cent prices are the common case, so two decimals would read as free. */
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3).replace(/0$/, '')}`
  return `$${usd.toFixed(4)}`
}

export function PromptDock({
  models,
  model,
  onModelChange,
  settings,
  onSettingChange,
  pending,
  error,
  onSubmit,
}: PromptDockProps) {
  const [prompt, setPrompt] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)

  /*
   * What this will cost, before committing to it. In byok mode that is fal's own
   * price; in saas mode the same number becomes credits. Shown on the button
   * because that is where the decision happens.
   */
  const cost = useMemo(() => {
    const units = estimateUnits(model, settings)
    return units * model.pricing.unitPriceUsd
  }, [model, settings])

  function submit() {
    const trimmed = prompt.trim()
    if (!trimmed || pending) return
    onSubmit(trimmed)
    setPrompt('')
    resize()
  }

  /** Grows to a cap, then scrolls. A dock that keeps growing eats the results. */
  function resize() {
    const node = textarea.current
    if (!node) return
    node.style.height = 'auto'
    const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 20
    node.style.height = `${Math.min(node.scrollHeight, lineHeight * MAX_ROWS)}px`
  }

  return (
    <div className="rounded-(--radius-panel) border border-line bg-surface">
      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt"
        ref={textarea}
        rows={2}
        value={prompt}
        placeholder="Describe the image you want"
        onChange={(event) => {
          setPrompt(event.target.value)
          resize()
        }}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter breaks the line. On a phone the button is
          // the only sane target, so it stays visible either way.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
        className="max-h-40 w-full resize-none bg-transparent px-4 pt-3 text-ink text-sm outline-none placeholder:text-ink-faint"
      />

      <div className="flex flex-wrap items-center gap-2 border-line border-t px-3 py-2">
        <ModelPicker models={models} selected={model} onSelect={onModelChange} />
        {model.inputs.map((input) => (
          <SettingField
            key={input.name}
            input={input}
            value={settings[input.name]}
            onChange={(value) => onSettingChange(input.name, value)}
          />
        ))}
        <Button
          type="button"
          tone="primary"
          size="sm"
          className="ml-auto"
          disabled={pending || prompt.trim().length === 0}
          onClick={submit}
        >
          {pending ? 'Sending' : `Generate · ${formatCost(cost)}`}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="border-line border-t px-4 py-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
