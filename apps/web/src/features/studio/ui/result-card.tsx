'use client'

import { cn } from '@genny/ui/cn.ts'
import type { JobProgress } from './use-job-stream.ts'

export type ResultItem = {
  jobId: string
  prompt: string
  modelName: string
  /** Handles of the assets this generation became, once ingested. */
  assetLabels: string[]
  // The job statuses, plus 'timeout' which only ever comes from the stream: the
  // job may still finish, so it is not a failure and is not stored as one.
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout'
  urls: string[]
  error: string | null
}

type ResultCardProps = {
  item: ResultItem
  live: JobProgress | null
  /** Appends `@label` to the prompt so an output can feed the next generation. */
  onMention: (label: string) => void
}

export function ResultCard({ item, live, onMention }: ResultCardProps) {
  const status = live?.status ?? item.status
  const urls = live?.urls ?? item.urls
  const error = live?.error ?? item.error
  const labels = live?.assetLabels ?? item.assetLabels

  return (
    <li className="overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
      {status === 'completed' && urls.length > 0 ? (
        <ul className={cn('grid gap-1', urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {urls.map((url, index) => (
            <li key={url} className="group relative">
              <img src={url} alt={item.prompt} loading="lazy" className="w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 flex gap-1 p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <a
                  href={url}
                  download
                  className="rounded-(--radius-control) bg-canvas/85 px-2 py-1 text-xs backdrop-blur"
                >
                  Download
                </a>
                {labels[index] ? (
                  <button
                    type="button"
                    onClick={() => onMention(labels[index] as string)}
                    className="rounded-(--radius-control) bg-canvas/85 px-2 py-1 text-xs backdrop-blur"
                  >
                    Use as reference
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Placeholder status={status} error={error} queuePosition={live?.queuePosition ?? null} />
      )}

      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm text-ink">{item.prompt}</p>
        <p className="text-ink-faint text-xs">{item.modelName}</p>
      </div>
    </li>
  )
}

function Placeholder({
  status,
  error,
  queuePosition,
}: {
  status: ResultItem['status']
  error: string | null
  queuePosition: number | null
}) {
  const failed = status === 'failed'
  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center px-4 text-center text-sm',
        failed ? 'bg-danger/10 text-danger' : 'animate-pulse bg-canvas text-ink-faint',
      )}
      role="status"
      aria-live="polite"
    >
      {failed ? (error ?? 'This generation failed.') : label(status, queuePosition)}
    </div>
  )
}

function label(status: ResultItem['status'], queuePosition: number | null): string {
  if (status === 'timeout') return 'Still running. Reload to check on it.'
  if (status === 'canceled') return 'Canceled'
  if (status === 'running') return 'Generating'
  return queuePosition !== null && queuePosition > 0 ? `Queued, ${queuePosition} ahead` : 'Queued'
}
