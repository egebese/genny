'use client'

import { mentionedLabels, unmention } from '@genny/models/mention.ts'
import { useRef } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import { type Attachment, AttachmentStrip, type MentionChip } from './attachment-strip.tsx'
import { DirectorPanel, type DirectorProps } from './director-panel.tsx'
import { DockControls } from './dock-controls.tsx'
import { DockNotice, whyBlocked } from './dock-notice.tsx'
import { MentionList } from './mention-list.tsx'
import { PromptField } from './prompt-field.tsx'
import { useMentions } from './use-mentions.ts'

/** One dock over every modality, so it asks for whatever the chosen model makes. */
const PLACEHOLDERS = {
  image: 'Describe the image you want, or @mention an asset',
  video: 'Describe the shot you want, or @mention an image to animate',
  audio: 'Write what should be said, or describe the sound you want',
} as const

type PromptDockProps = {
  families: PickableFamily[]
  family: PickableFamily
  /** The endpoint the attachments resolved to. What is priced and what is sent. */
  model: PickableModel | null
  onModelChange: (family: PickableFamily) => void
  mentionables: MentionableView[]
  /** Assets pinned to a named input, rather than named in the sentence. */
  attachments: Attachment[]
  onRemoveAttachment: (index: number) => void
  /** Handles the prompt names that resolve to something, with their previews. */
  mentions: MentionChip[]
  /** Which of those handles resolve; the rest are marked as a miss in the text. */
  resolvable: ReadonlySet<string>
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
  /** The other thing the box can do: talk to the director instead of generating. */
  director: DirectorProps
}

const DIRECTOR_PLACEHOLDER = 'Ask for what to shoot next, or what is wrong with these'

const MAX_ROWS = 6

export function PromptDock(props: PromptDockProps) {
  const { model, settings, pending, error, onSubmit, prompt } = props
  /*
   * What the dock draws when nothing in the family fits what is attached. The
   * controls still have to be something, and the notice underneath says why the
   * button is off; showing an empty dock instead would answer a question nobody
   * asked with a blank.
   */
  const shown = model ?? (props.family.variants[0] as PickableModel)
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

  const director = props.director

  function submit() {
    const trimmed = prompt.trim()
    if (!trimmed || pending) return
    // One box, two things it can do. Which one is a mode rather than a second
    // input, because a studio with two places to type is a studio where half
    // of what you write goes to the wrong one.
    if (director.on) {
      director.onAsk(trimmed)
      // A question asked is gone; a prompt sent is not. Most of the next
      // generation is the last one with a word changed, which is why clearing
      // it was removed once already.
      setPrompt('')
    } else {
      onSubmit(trimmed)
    }
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

  /*
   * An editing model cannot run without an image. Blocking here beats letting
   * fal answer 422 with a reason the person cannot see.
   */

  const block = whyBlocked({
    family: props.family,
    model,
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
      {director.on ? (
        <DirectorPanel
          turns={director.turns}
          asking={director.asking}
          error={director.error}
          onUse={(next) => {
            director.onToggle()
            setPrompt(next)
          }}
          onClear={director.onClear}
        />
      ) : null}

      <PromptField
        value={prompt}
        placeholder={director.on ? DIRECTOR_PLACEHOLDER : PLACEHOLDERS[shown.modality]}
        known={props.resolvable}
        mentions={mentions}
        textarea={textarea}
        onChange={(next, caret) => {
          setPrompt(next)
          mentions.sync(next, caret)
          resize()
        }}
        onSubmit={submit}
      />

      <DockControls
        families={props.families}
        family={props.family}
        model={shown}
        settings={settings}
        credits={props.credits}
        pending={pending}
        blocked={block !== null}
        empty={prompt.trim().length === 0}
        directing={director.on}
        asking={director.asking}
        onDirect={director.onToggle}
        onModelChange={props.onModelChange}
        onSettingChange={props.onSettingChange}
        onSubmit={submit}
      />

      {director.on ? null : <DockNotice block={block} family={props.family} />}

      {error ? (
        <p role="alert" className="border-line border-t px-4 py-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
