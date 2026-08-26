'use client'

import { estimateUnits } from '@genny/models/credits.ts'
import { Button } from '@genny/ui/button.tsx'
import { useMemo, useRef } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import { MentionList } from './mention-list.tsx'
import { ModelPicker } from './model-picker.tsx'
import { SettingField } from './setting-field.tsx'
import { useMentions } from './use-mentions.ts'

type PromptDockProps = {
  models: PickableModel[]
  model: PickableModel
  onModelChange: (model: PickableModel) => void
  mentionables: MentionableView[]
  settings: Record<string, unknown>
  onSettingChange: (name: string, value: unknown) => void
  pending: boolean
  error: string | null
  /** Composed text lives in the studio, so a result can append a mention to it. */
  prompt: string
  onPromptChange: (next: string) => void
  onSubmit: (prompt: string) => void
}

const MAX_ROWS = 6

/** Sub-cent prices are the common case, so two decimals would read as free. */
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3).replace(/0$/, '')}`
  return `$${usd.toFixed(4)}`
}

export function PromptDock(props: PromptDockProps) {
  const { model, settings, pending, error, onSubmit, prompt } = props
  const setPrompt = props.onPromptChange
  const textarea = useRef<HTMLTextAreaElement>(null)

  const mentions = useMentions({
    mentionables: props.mentionables,
    text: prompt,
    onReplace: (next) => {
      setPrompt(next.text)
      // Restore the caret after React has written the new value, or the browser
      // puts it at the end of the text and typing continues in the wrong place.
      requestAnimationFrame(() => {
        textarea.current?.setSelectionRange(next.caret, next.caret)
        textarea.current?.focus()
      })
    },
  })

  /*
   * What this will cost, before committing to it. In byok mode that is fal's own
   * price; in saas mode the same number becomes credits.
   */
  const cost = useMemo(
    () => estimateUnits(model, settings) * model.pricing.unitPriceUsd,
    [model, settings],
  )

  function submit() {
    const trimmed = prompt.trim()
    if (!trimmed || pending) return
    onSubmit(trimmed)
    mentions.close()
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

  const activeOption = mentions.active ? mentions.candidates[mentions.highlighted] : undefined

  return (
    <div className="rounded-(--radius-panel) border border-line bg-surface">
      {mentions.active ? (
        <MentionList
          candidates={mentions.candidates}
          highlighted={mentions.highlighted}
          query={mentions.active.query}
          onChoose={mentions.choose}
        />
      ) : null}

      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt"
        ref={textarea}
        rows={2}
        value={prompt}
        placeholder="Describe the image you want, or @mention an asset"
        role="combobox"
        aria-expanded={mentions.active !== null}
        aria-controls="mention-list"
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `mention-option-${activeOption.id}` : undefined}
        onChange={(event) => {
          setPrompt(event.target.value)
          mentions.sync(event.target.value, event.target.selectionStart)
          resize()
        }}
        onSelect={(event) => {
          const node = event.currentTarget
          mentions.sync(node.value, node.selectionStart)
        }}
        onKeyDown={(event) => {
          if (mentions.handleKey(event.key)) {
            event.preventDefault()
            return
          }
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
        <ModelPicker models={props.models} selected={model} onSelect={props.onModelChange} />
        {model.inputs.map((input) => (
          <SettingField
            key={input.name}
            input={input}
            value={settings[input.name]}
            onChange={(value) => props.onSettingChange(input.name, value)}
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
