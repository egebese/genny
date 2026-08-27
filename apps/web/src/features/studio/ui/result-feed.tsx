'use client'

import { Button } from '@genny/ui/button.tsx'
import { LiveResultCard } from './live-result-card.tsx'
import type { ResultItem } from './result-card.tsx'

/*
 * An empty feed that says "nothing here yet" asks the person to invent an
 * opening move. These are the opening move: one tap fills the prompt and the
 * only thing left is to press generate.
 */
const OPENERS: Record<'image' | 'video' | 'audio', string[]> = {
  image: [
    'a lone red umbrella on a rain-slick street at dusk, cinematic',
    'overhead flat lay of brass tools on dark walnut, single warm lamp',
    'fog rolling over pine ridges at first light, muted greens',
  ],
  video: [
    'a paper boat drifting down a rain gutter, close up, overcast afternoon',
    'steam rising off a cup on a windowsill, slow push in',
    'headlights sweeping across a wet warehouse wall at night',
  ],
  audio: [
    'Genny is an open source studio for generative media, built on fal.',
    'a slow upright bass line under soft brushed drums, late night',
    'rain on a tin roof, distant thunder, no music',
  ],
}

type ResultFeedProps = {
  modality: 'image' | 'video' | 'audio'
  onSuggest: (prompt: string) => void
  results: ResultItem[]
  /** Cursor for the next page, or null when there is no more. */
  cursor: string | null
  loadingMore: boolean
  onLoadMore: () => void
  onMention: (label: string) => void
}

/** Everything above the dock: the balance, the work, and the way to older work. */
export function ResultFeed({
  modality,
  onSuggest,
  results,
  cursor,
  loadingMore,
  onLoadMore,
  onMention,
}: ResultFeedProps) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <p className="text-ink-faint text-sm">Nothing generated yet. Try one of these.</p>
          <ul
            aria-label="Prompt suggestions"
            className="flex max-w-2xl flex-wrap justify-center gap-2"
          >
            {OPENERS[modality].map((opener) => (
              <li key={opener}>
                <button
                  type="button"
                  onClick={() => onSuggest(opener)}
                  className="max-w-xs truncate rounded-full border border-line bg-surface px-3 py-1.5 text-ink-muted text-xs transition-colors hover:bg-surface-hover hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {opener}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul aria-label="Generations" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <LiveResultCard key={item.jobId} item={item} onMention={onMention} />
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="mt-6 flex justify-center">
          <Button type="button" tone="neutral" disabled={loadingMore} onClick={() => onLoadMore()}>
            {loadingMore ? 'Loading' : 'Load older'}
          </Button>
        </div>
      ) : null}
    </main>
  )
}
