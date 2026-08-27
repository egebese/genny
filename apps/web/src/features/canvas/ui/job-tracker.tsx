'use client'

import { useEffect } from 'react'
import { useJobStream } from './use-job-stream.ts'

/**
 * One open stream per unfinished generation, mounted as a component so each gets
 * its own hook. The board runs several at once, which a single hook cannot do,
 * and a component per job is how React says "N of these".
 *
 * Renders nothing. It exists for its effect.
 */
export function JobTracker({ jobId, onSettled }: { jobId: string; onSettled: () => void }) {
  const progress = useJobStream(jobId, true)
  const settled =
    progress?.status === 'completed' ||
    progress?.status === 'failed' ||
    progress?.status === 'canceled'

  useEffect(() => {
    if (settled) onSettled()
  }, [settled, onSettled])

  return null
}
