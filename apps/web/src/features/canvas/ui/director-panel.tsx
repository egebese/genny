'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import type { Turn } from './use-director.ts'

type DirectorPanelProps = {
  turns: Turn[]
  asking: boolean
  error: string | null
  /** Loads a proposed shot into the prompt. It is never run from here. */
  onUse: (prompt: string) => void
  onClear: () => void
}

/** Everything the dock needs to hand the director its half of the box. */
export type DirectorProps = {
  on: boolean
  onToggle: () => void
  turns: Turn[]
  asking: boolean
  error: string | null
  onAsk: (question: string) => void
  onClear: () => void
}

/**
 * The conversation, above the prompt and in the flow of the dock.
 *
 * The same shape as the mention list: it pushes the prompt down rather than
 * covering anything, it never takes focus, and it scrolls at a cap instead of
 * growing until it eats the board. A director in a panel of its own would be
 * a second input box, and there is one input box.
 *
 * A proposed shot loads into the prompt rather than running. The agent wrote a
 * sentence; whether to spend money on it is not its decision, and the price is
 * on the button as it always is.
 */
export function DirectorPanel({ turns, asking, error, onUse, onClear }: DirectorPanelProps) {
  if (turns.length === 0 && !asking && !error) {
    return (
      <p className="border-line border-b px-4 py-3 text-ink-faint text-sm">
        Ask for what to shoot next, or pick a few results and ask what is wrong with them. It knows
        the brief and what these boards have turned out to be about.
      </p>
    )
  }

  return (
    <div className="max-h-[min(20rem,40dvh)] space-y-4 overflow-y-auto border-line border-b p-4">
      {turns.map((turn) => (
        <article key={`${turn.question}-${turn.reply.slice(0, 24)}`} className="space-y-2">
          <p className="text-ink-faint text-xs">{turn.question}</p>
          <p className="whitespace-pre-wrap text-ink text-sm">{turn.reply}</p>

          {turn.shots.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {turn.shots.map((shot) => (
                <li key={shot.prompt}>
                  <button
                    type="button"
                    onClick={() => onUse(shot.prompt)}
                    title={shot.prompt}
                    className="flex items-center gap-1.5 rounded-(--radius-control) bg-control px-2.5 py-1.5 text-ink text-xs outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Icon name="plus" className="size-3 text-ink-faint" />
                    {shot.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}

      {asking ? (
        <p className="flex items-center gap-2 text-ink-faint text-sm">
          <Spinner label="Thinking" />
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      {turns.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-(--radius-control) text-ink-faint text-xs outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}
