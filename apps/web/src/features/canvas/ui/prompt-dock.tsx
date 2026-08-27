'use client'

import { mentionedLabels, unmention } from '@genny/models/mention.ts'
import { useRef } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import { type Attachment, AttachmentStrip, type MentionChip } from './attachment-strip.tsx'
import { DockNotice, whyBlocked } from './dock-notice.tsx'
import { GenerateButton } from './generate-button.tsx'
import { MentionList } from './mention-list.tsx'
import { PROMPT_BOX, PromptHighlight } from './prompt-highlight.tsx'
import { SettingsRow } from './settings-row.tsx'
import { useMentions } from './use-mentions.ts'

/** One dock over every modality, so it asks for whatever the chosen model makes. */
const PLACEHOLDERS = {
  image: 'Describe the image you want, or @mention an asset',
  video: 'Describe the shot you want, or @mention an image to animate',
  audio: 'Write what should be said, or describe the sound you want',
} as const

type PromptDockProps = {
  models: PickableModel[]
  model: PickableModel
  onModelChange: (model: PickableModel) => void
  mentionables: MentionableView[]
  /** Assets pinned to a named input, rather than named in the sentence. */
  attachments: Attachment[]
  onRemoveAttachment: (index: number) => void
  /** Handles the prompt names that resolve to something, with their previews. */
  mentions: MentionChip[]
  /** Which of those handles resolve; the rest are marked as a miss in the text. */
  resolvable: ReadonlySet<string>
  /** The nearest model that could take what this one cannot, if there is one. */
  suggestion: PickableModel | null
  settings: Record<string, unknown>
  onSettingChange: (name: string, value: unknown) => void
  pending: boolean
  error: string | null
  /** Credits when saas mode is on, dollars otherwise: the same number, priced. */
  credits: { enabled: boolean; perUsd: number } | null
  /** Composed text lives in the studio, so a result can append a mention to it. */
  prompt: string
  onPromptChange: (next: string) => void
  onSubmit: (prompt: string) => void
}

const MAX_ROWS = 6

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

  /*
   * An editing model cannot run without an image. Blocking here beats letting
   * fal answer 422 with a reason the person cannot see.
   */

  const block = whyBlocked({
    model,
    suggestion: props.suggestion,
    mentionCount: mentionedLabels(prompt).length,
    attachmentCount: props.attachments.length,
    carrying: props.mentions.length > 0 || props.attachments.length > 0,
  })

  return (
    <div data-dock className="panel rounded-(--radius-dock) shadow-(--shadow-dock)">
      {mentions.active ? (
        <MentionList
          candidates={mentions.candidates}
          highlighted={mentions.highlighted}
          query={mentions.active.query}
          onChoose={mentions.choose}
        />
      ) : null}

      <AttachmentStrip
        attachments={props.attachments}
        mentions={props.mentions}
        onRemove={props.onRemoveAttachment}
        onUnmention={(label) => setPrompt(unmention(prompt, label))}
      />

      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      {/* The highlight is a second copy of the same text, painted underneath.
          Both take their metrics from PROMPT_BOX so they stay exactly as wide. */}
      <div className="relative">
        <PromptHighlight text={prompt} known={props.resolvable} scroller={textarea} />
        <textarea
          id="prompt"
          ref={textarea}
          rows={2}
          value={prompt}
          placeholder={PLACEHOLDERS[model.modality]}
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
          className={`${PROMPT_BOX} relative max-h-40 w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-faint`}
        />
      </div>

      <div className="flex items-end gap-2 px-3 pt-2 pb-3">
        <SettingsRow
          models={props.models}
          model={model}
          settings={settings}
          onModelChange={props.onModelChange}
          onSettingChange={props.onSettingChange}
        />
        <GenerateButton
          model={model}
          settings={settings}
          credits={props.credits}
          pending={pending}
          disabled={prompt.trim().length === 0 || block !== null}
          onClick={submit}
        />
      </div>

      <DockNotice block={block} model={model} onModelChange={props.onModelChange} />

      {error ? (
        <p role="alert" className="border-line border-t px-4 py-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
