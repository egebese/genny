'use client'

import { Button } from '@genny/ui/button.tsx'
import Link from 'next/link'

/**
 * A board that failed to load, without taking the whole app down with it.
 *
 * `global-error` only catches what escapes the root layout, so before this a
 * canvas that threw while rendering left the studio chrome intact around an
 * empty space, with no way to retry short of a manual reload.
 */
export default function CanvasError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-semibold text-2xl tracking-tight">This canvas would not open</h1>
      <p className="max-w-md text-ink-muted">
        Nothing on it was lost. Trying again is usually enough; if it is not, the other canvases
        still open.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button tone="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/c">
          <Button tone="ghost">All canvases</Button>
        </Link>
      </div>
    </main>
  )
}
