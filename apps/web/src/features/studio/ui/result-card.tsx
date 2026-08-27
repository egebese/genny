'use client'

import { mediaKindFromUrl } from '@genny/assets/media.ts'
import { cn } from '@genny/ui/cn.ts'
import { Sparkle } from '@genny/ui/sparkle.tsx'
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

  /*
   * The output is the card. A bordered box with a caption block underneath made
   * a page of generations read as a list of records; here the media carries the
   * row and the prompt is one quiet line under it, which is what every studio
   * worth copying does.
   */
  return (
    // min-w-0 because a grid track is minmax(auto, 1fr) and an image's auto
    // minimum is its intrinsic width: without it one wide result stretches the
    // column past the viewport and the whole page scrolls sideways.
    <li className="min-w-0">
      {status === 'completed' && urls.length > 0 ? (
        <ul
          className={cn(
            'grid gap-1 overflow-hidden rounded-(--radius-panel) border border-line bg-surface',
            urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {urls.map((url, index) => (
            <li key={url} className="group relative min-w-0">
              <Media url={url} alt={item.prompt} />
              <span className="absolute inset-x-0 bottom-0 flex gap-1 p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <a
                  href={url}
                  download
                  className="rounded-(--radius-control) bg-canvas/85 px-2 py-1 text-xs backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Download
                </a>
                {labels[index] ? (
                  <button
                    type="button"
                    onClick={() => onMention(labels[index] as string)}
                    className="rounded-(--radius-control) bg-canvas/85 px-2 py-1 text-xs backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <div className="mt-2.5 space-y-1 px-0.5">
        <p className="truncate text-ink text-sm lowercase">{item.prompt}</p>
        <p className="flex items-center gap-1.5 truncate font-mono text-[11px] text-ink-faint uppercase tracking-[0.06em]">
          <Sparkle className="size-2.5 shrink-0" />
          {item.modelName}
        </p>
      </div>
    </li>
  )
}

/**
 * The output, however it plays. Controls but no autoplay: a grid of results that
 * all start talking at once is unusable, and on a phone it is expensive.
 */
function Media({ url, alt }: { url: string; alt: string }) {
  const kind = mediaKindFromUrl(url)

  if (kind === 'video') {
    return (
      // biome-ignore lint/a11y/useMediaCaption: generated video has no caption track
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className="w-full bg-canvas object-cover"
      />
    )
  }

  if (kind === 'audio') {
    return (
      <span className="flex aspect-video items-center justify-center bg-canvas p-4">
        {/* biome-ignore lint/a11y/useMediaCaption: generated audio has no caption track */}
        <audio src={url} controls preload="metadata" aria-label={alt} className="w-full" />
      </span>
    )
  }

  return <img src={url} alt={alt} loading="lazy" className="w-full object-cover" />
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
        'flex aspect-square items-center justify-center rounded-(--radius-panel) border border-line px-4 text-center text-sm',
        failed ? 'bg-danger/10 text-danger' : 'animate-pulse bg-surface text-ink-faint',
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
