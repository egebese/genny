'use client'

import { useEffect, useState } from 'react'

export type JobProgress = {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout'
  queuePosition?: number | null
  urls?: string[]
  /** Handles of the ingested assets, so a fresh result can be mentioned at once. */
  assetLabels?: string[]
  error?: string
}

type StreamEvent = JobProgress & { jobId: string }

/**
 * Follows one job over server-sent events.
 *
 * EventSource rather than a polling fetch: the server already knows when the job
 * changes, and a client poll multiplies that by every open tab. It also
 * reconnects on its own, which matters on a phone that just changed networks.
 */
export function useJobStream(jobId: string | null, enabled: boolean): JobProgress | null {
  const [progress, setProgress] = useState<JobProgress | null>(null)

  useEffect(() => {
    if (!jobId || !enabled) return
    setProgress(null)

    const source = new EventSource(`/api/jobs/${jobId}/stream`)

    source.onmessage = (message) => {
      const event = parseEvent(message.data)
      if (!event) return
      setProgress(event)
      // Nothing more is coming, and leaving the connection open makes the browser
      // retry a stream the server has already finished with.
      if (event.status === 'completed' || event.status === 'failed') source.close()
    }

    source.onerror = () => {
      // EventSource retries by itself. Only give up once the connection is
      // definitively closed, otherwise a brief network blip looks like a failure.
      if (source.readyState === EventSource.CLOSED) {
        setProgress((current) =>
          current?.status === 'completed'
            ? current
            : { status: 'failed', error: 'Lost the connection while tracking this generation.' },
        )
      }
    }

    return () => source.close()
  }, [jobId, enabled])

  return progress
}

function parseEvent(raw: string): StreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as StreamEvent
    return typeof candidate.status === 'string' ? candidate : null
  } catch {
    return null
  }
}
