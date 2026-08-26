'use client'

import { Button } from '@genny/ui/button.tsx'
import { LiveResultCard } from './live-result-card.tsx'
import type { ResultItem } from './result-card.tsx'

type ResultFeedProps = {
  results: ResultItem[]
  /** Cursor for the next page, or null when there is no more. */
  cursor: string | null
  loadingMore: boolean
  onLoadMore: () => void
  onMention: (label: string) => void
}

/** Everything above the dock: the balance, the work, and the way to older work. */
export function ResultFeed({
  results,
  cursor,
  loadingMore,
  onLoadMore,
  onMention,
}: ResultFeedProps) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {results.length === 0 ? (
        <p className="py-20 text-center text-ink-faint">
          Nothing generated yet. Write a prompt below.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
