'use client'

import { anchorPanel } from '@genny/canvas/anchor.ts'
import { toScreen, type Viewport } from '@genny/canvas/geometry.ts'
import { Alert } from '@genny/ui/alert.tsx'
import { Button } from '@genny/ui/button.tsx'
import { Spinner } from '@genny/ui/spinner.tsx'
import { useEffect, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { type JobDetail, jobDetail } from '../server/job-detail.ts'
import { JobFacts } from './job-facts.tsx'
import { PanelActions } from './panel-actions.tsx'

const PANEL = { width: 320, height: 460 }

/**
 * The panel, no wider than the board it floats over.
 *
 * 320 was a constant, and on a 375px phone that left 43 pixels of board beside
 * it, which is a panel pretending not to be a takeover. It shrinks now, and
 * `anchorPanel` stacks it under the node rather than across it.
 */
function panelSize(bounds: { width: number; height: number }) {
  return {
    width: Math.min(PANEL.width, Math.max(240, bounds.width - 24)),
    height: Math.min(PANEL.height, Math.max(200, bounds.height - 24)),
  }
}

export type ReuseRequest = { modelId: string; prompt: string; settings: Record<string, unknown> }

type NodePanelProps = {
  node: CanvasNodeView
  /** Every model this board knows, so the panel can mark whichever made this. */
  models: PickableModel[]
  /** Credits are a saas idea; in byok the visitor spends their own fal balance. */
  showCost: boolean
  viewport: Viewport
  bounds: { width: number; height: number }
  onClose: () => void
  onMention: (label: string) => void
  onReuse: (request: ReuseRequest) => void
  onCancel: () => void
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

  const made = props.models.find((model) => model.endpointId === detail?.endpointId)

  const size = panelSize(props.bounds)
  const screen = toScreen({ x: node.x, y: node.y }, viewport)
  const position = anchorPanel(
    { ...screen, width: node.width * viewport.zoom, height: node.height * viewport.zoom },
    size,
    props.bounds,
  )

  return (
    <aside
      aria-label="Generation details"
      data-overlay
      /*
       * A fixed height, not a maximum. `anchorPanel` places it by the height it
       * was told about, so a shorter panel would sit where a taller one would
       * have, and the body below is what scrolls either way.
       */
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      className="panel absolute z-20 flex flex-col overflow-hidden rounded-(--radius-panel)"
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
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
          <JobFacts
            detail={detail}
            markUrl={made?.markUrl ?? null}
            inputs={made?.inputs ?? []}
            promptField={made?.promptField ?? 'prompt'}
            showCost={props.showCost}
          />
        ) : (
          <p className="text-ink-muted text-sm">
            Placed from the asset library, so there is no generation behind it.
          </p>
        )}
      </div>

      <PanelActions
        node={node}
        detail={detail}
        onMention={props.onMention}
        onReuse={props.onReuse}
        onCancel={props.onCancel}
        onDelete={props.onDelete}
      />
    </aside>
  )
}
