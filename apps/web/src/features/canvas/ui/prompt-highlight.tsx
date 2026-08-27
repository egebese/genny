'use client'

import { splitMentions } from '@genny/models/mention.ts'
import { cn } from '@genny/ui/cn.ts'
import type { RefObject } from 'react'

/**
 * Everything about the box that decides where a character lands. Shared with the
 * textarea rather than copied, because a highlight one pixel off its word reads
 * as a rendering bug and this is the whole list of ways to get there.
 */
export const PROMPT_BOX = 'px-4 pt-3 text-sm leading-normal tracking-normal'

type PromptHighlightProps = {
  text: string
  /** Handles that resolve to something. An unknown one is marked as a miss. */
  known: ReadonlySet<string>
  scroller: RefObject<HTMLTextAreaElement | null>
}

/**
 * The mention marks, painted underneath a transparent textarea.
 *
 * A textarea holds one string and cannot contain elements, so an inline chip
 * would mean a contenteditable, and a contenteditable's behaviour with an IME or
 * a phone keyboard is unpredictable in ways a textarea's is not. This draws the
 * same text again in transparent ink and gives the tokens a background, so the
 * real characters sit on top of their own highlight and the caret, selection and
 * autocorrect are all still the browser's.
 *
 * The square previews live in the strip above, where they are big enough to
 * recognise. Nothing inline can carry an image without changing how wide the
 * text is, and the two copies have to stay exactly as wide as each other.
 */
export function PromptHighlight({ text, known, scroller }: PromptHighlightProps) {
  return (
    <div
      aria-hidden
      ref={(node) => {
        // Follows the textarea once it starts scrolling, or the marks drift off
        // their words as soon as the prompt is taller than the box.
        if (node && scroller.current) node.scrollTop = scroller.current.scrollTop
      }}
      className={cn(
        PROMPT_BOX,
        'pointer-events-none absolute inset-0 select-none overflow-hidden',
        'whitespace-pre-wrap break-words text-transparent',
      )}
    >
      {/* Keyed by where the segment starts. Positional is the truth here: the
          whole list is rebuilt on every keystroke and nothing in it has an
          identity that outlives the character before it. */}
      {segments(text).map((segment) =>
        segment.label === undefined ? (
          <span key={segment.at}>{segment.text}</span>
        ) : (
          <span
            key={segment.at}
            /*
             * Background and underline only. Padding on the sides would make
             * this copy wider than the textarea's and slide every mark after it
             * off its word; vertical padding is free, because it overflows the
             * line box instead of growing it.
             */
            className={cn(
              'rounded-[3px] py-[2px] underline decoration-1 underline-offset-[3px]',
              known.has(segment.label)
                ? 'bg-accent/20 decoration-accent'
                : 'bg-danger/10 decoration-danger/70 decoration-wavy',
            )}
          >
            {segment.text}
          </span>
        ),
      )}
      {/* A trailing newline is not rendered by a div the way it is by a textarea,
          so without this the last line scrolls out of step. */}
      {text.endsWith('\n') ? ' ' : null}
    </div>
  )
}

/** The same split, plus each segment's offset, which is its only stable key. */
function segments(text: string) {
  let at = 0
  return splitMentions(text).map((segment) => {
    const positioned = { ...segment, at }
    at += segment.text.length
    return positioned
  })
}
