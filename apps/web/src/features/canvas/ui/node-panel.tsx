'use client'

import { anchorPanel } from '@genny/canvas/anchor.ts'
import { toScreen, type Viewport } from '@genny/canvas/geometry.ts'
import { Alert } from '@genny/ui/alert.tsx'
import { Button } from '@genny/ui/button.tsx'
import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import { useEffect, useState } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { type JobDetail, jobDetail } from '../server/job-detail.ts'
import { JobFacts } from './job-facts.tsx'

const PANEL = { width: 320, height: 460 }

export type ReuseRequest = { modelId: string; prompt: string; settings: Record<string, unknown> }

type NodePanelProps = {
  node: CanvasNodeView
  viewport: Viewport
  bounds: { width: number; height: number }
  onClose: () => void
  onMention: (label: string) => void
  onReuse: (request: ReuseRequest) => void
  onDelete: () => void
}

/**
 * The detail view, hung off the selected node in screen space.
 *
 * Not a route and not a modal: on a board the thing you are inspecting is the
 * thing you are about to compare against or reuse, and taking the board away to
 * show its own contents is the wrong trade. Escape and the close button both
 * dismiss it, and nothing behind it is inert.
 */
export function NodePanel(props: NodePanelProps) {
  const { node, viewport } = props
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!node.jobId) return
    let live = true
    setLoading(true)
    jobDetail(node.jobId)
      .then((result) => live && setDetail(result))
      .catch(() => live && setDetail(null))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [node.jobId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && props.onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])

  const screen = toScreen({ x: node.x, y: node.y }, viewport)
  const position = anchorPanel(
    { ...screen, width: node.width * viewport.zoom, height: node.height * viewport.zoom },
    PANEL,
    props.bounds,
  )

  return (
    <aside
      aria-label="Generation details"
      style={{ left: position.x, top: position.y, width: PANEL.width, maxHeight: PANEL.height }}
      className="absolute z-20 flex flex-col overflow-hidden rounded-(--radius-panel) border border-line bg-surface/95 shadow-(--shadow-dock) backdrop-blur"
    >
      <header className="flex items-center justify-between gap-2 border-line border-b px-3 py-2">
        <h2 className="truncate font-medium text-ink text-sm">
          {detail?.modelName ?? (node.label || 'Result')}
        </h2>
        <Button
          type="button"
          tone="ghost"
          size="sm"
          onClick={props.onClose}
          aria-label="Close details"
        >
          Close
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {node.status === 'failed' && node.error ? (
          <Alert tone="danger" className="mb-3">
            {node.error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-ink-muted text-sm">
            <Spinner /> Loading details
          </p>
        ) : detail ? (
          <JobFacts detail={detail} />
        ) : (
          <p className="text-ink-muted text-sm">
            Placed from the asset library, so there is no generation behind it.
          </p>
        )}
      </div>

      <footer className="flex flex-wrap gap-1 border-line border-t px-3 py-2">
        {node.url ? (
          <a
            href={node.url}
            download
            className="inline-flex h-9 items-center rounded-(--radius-control) px-3 text-ink-muted text-sm outline-none hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            Download
          </a>
        ) : null}
        {node.label ? (
          <Button
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => props.onMention(node.label ?? '')}
          >
            Use as reference
          </Button>
        ) : null}
        {detail ? (
          <Button
            type="button"
            tone="ghost"
            size="sm"
            onClick={() =>
              props.onReuse({
                modelId: detail.endpointId,
                prompt: detail.prompt,
                settings: detail.settings,
              })
            }
          >
            Reuse settings
          </Button>
        ) : null}
        <ConfirmInline
          label="Delete"
          question="Remove this from the board?"
          confirmLabel="Remove"
          onConfirm={props.onDelete}
        />
      </footer>
    </aside>
  )
}
