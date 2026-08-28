'use client'

import { Button } from '@genny/ui/button.tsx'
import type { RefObject } from 'react'

/**
 * The zoom control in the corner of the board.
 *
 * The percentage is written by the viewport rather than rendered from it. A
 * pinch changes that number sixty times a second, and re-rendering the board
 * for it is the exact cost the gesture goes out of its way to avoid; the
 * initial value here is only what it says before the first move.
 */
export function ZoomControl({
  zoom,
  readout,
  onZoom,
  onFit,
}: {
  zoom: number
  readout: RefObject<HTMLSpanElement | null>
  onZoom: (factor: number) => void
  onFit: () => void
}) {
  return (
    <div className="panel pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-(--radius-panel) p-1">
      <Button
        type="button"
        tone="ghost"
        size="sm"
        aria-label="Zoom out"
        onClick={() => onZoom(1 / 1.2)}
      >
        &minus;
      </Button>
      <span
        ref={readout}
        className="min-w-12 text-center font-mono text-ink-muted text-xs tabular-nums"
      >
        {Math.round(zoom * 100)}%
      </span>
      <Button type="button" tone="ghost" size="sm" aria-label="Zoom in" onClick={() => onZoom(1.2)}>
        +
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={onFit}>
        Fit
      </Button>
    </div>
  )
}
