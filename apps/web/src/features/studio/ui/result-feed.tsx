'use client'

import { Button } from '@genny/ui/button.tsx'
import { LiveResultCard } from './live-result-card.tsx'
import type { ResultItem } from './result-card.tsx'

type ResultFeedProps = {
  /** Null in byok mode, where the visitor spends their own fal balance. */
  credits: { balance: string; holdBalance: string; perUsd: number } | null
  results: ResultItem[]
  /** Cursor for the next page, or null when there is no more. */
  cursor: string | null
  loadingMore: boolean
  onLoadMore: () => void
  onMention: (label: string) => void
}

/** Everything above the dock: the balance, the work, and the way to older work. */
export function ResultFeed({
  credits,
  results,
  cursor,
  loadingMore,
  onLoadMore,
  onMention,
}: ResultFeedProps) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {credits ? (
        <p className="mb-4 text-ink-muted text-sm">
          <span className="font-mono text-ink">{Math.floor(Number(credits.balance))}</span> credits
          {Number(credits.holdBalance) > 0 ? (
            <span className="text-ink-faint">
              {' '}
              · {Math.ceil(Number(credits.holdBalance))} reserved
            </span>
          ) : null}
        </p>
      ) : null}

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
