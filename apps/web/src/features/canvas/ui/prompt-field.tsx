'use client'

import type { RefObject } from 'react'
import { PROMPT_BOX, PromptHighlight } from './prompt-highlight.tsx'
import type { useMentions } from './use-mentions.ts'

type PromptFieldProps = {
  value: string
  placeholder: string
  known: ReadonlySet<string>
  mentions: ReturnType<typeof useMentions>
  textarea: RefObject<HTMLTextAreaElement | null>
  onChange: (value: string, caret: number) => void
  onSubmit: () => void
}

/**
 * The prompt, and the marks painted under it.
 *
 * Both take their metrics from `PROMPT_BOX`, because the highlight is a second
 * copy of the same string and one pixel of disagreement puts every mark beside
 * its word instead of on it.
 */
export function PromptField(props: PromptFieldProps) {
  const { mentions } = props
  const active = mentions.active ? mentions.candidates[mentions.highlighted] : undefined

  return (
    <div className="relative">
      <PromptHighlight text={props.value} known={props.known} scroller={props.textarea} />
      <textarea
        id="prompt"
        ref={props.textarea}
        rows={2}
        value={props.value}
        placeholder={props.placeholder}
        role="combobox"
        aria-expanded={mentions.active !== null}
        aria-controls="mention-list"
        aria-autocomplete="list"
        aria-activedescendant={active ? `mention-option-${active.id}` : undefined}
        onChange={(event) => props.onChange(event.target.value, event.target.selectionStart)}
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
            props.onSubmit()
          }
        }}
        className={`${PROMPT_BOX} relative max-h-40 w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-faint`}
      />
    </div>
  )
}
