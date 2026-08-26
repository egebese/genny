'use client'

import { ResultCard, type ResultItem } from './result-card.tsx'
import { useJobStream } from './use-job-stream.ts'

/**
 * One card, one stream. The hook lives here rather than in the list because a
 * hook cannot be called in a loop, and because a finished card should not hold a
 * connection open: `enabled` closes it as soon as there is nothing to follow.
 */
export function LiveResultCard({
  item,
  onMention,
}: {
  item: ResultItem
  onMention: (label: string) => void
}) {
  const unfinished = item.status === 'queued' || item.status === 'running'
  const live = useJobStream(item.jobId, unfinished)
  return <ResultCard item={item} live={live} onMention={onMention} />
}
