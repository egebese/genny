'use client'

import type { Rect } from '@genny/canvas/geometry.ts'
import { nodeSize, placeFree, rowFootprint, siblingRects } from '@genny/canvas/placement.ts'
import { useCallback } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { makeVariants } from '../server/make-variants.ts'

/** Four. Enough to see a direction, few enough to read at once and to pay for. */
export const VARIANT_COUNT = 4

export type VariantOutcome = { ok: true; nodes: CanvasNodeView[] } | { ok: false; reason: string }

/**
 * Four more of one node, laid out under it.
 *
 * Under rather than beside: variants of a thing belong with the thing, and a row
 * starting at its left edge reads as a second row of the same shot. The
 * rectangles are found here for the same reason a generation's are, which is
 * that only the browser knows what is already on the board.
 *
 * In two halves, like a generation. An agent writes the four prompts before any
 * image starts, and that is two seconds during which the count and the
 * positions are already known and no reason for the board to look empty.
 */
export function useVariants(canvasId: string, nodes: CanvasNodeView[]) {
  const reserve = useCallback(
    (source: CanvasNodeView): { rects: Rect[]; nodes: CanvasNodeView[] } => {
      const size = nodeSize(source)
      const footprint = rowFootprint(size, VARIANT_COUNT)
      const anchor = {
        ...placeFree(nodes, { x: source.x, y: source.y + source.height + 24 }, footprint),
        ...size,
      }
      const rects = siblingRects(anchor, VARIANT_COUNT)
      return { rects, nodes: rects.map(reservedNode) }
    },
    [nodes],
  )

  const send = useCallback(
    async (source: CanvasNodeView, rects: Rect[]): Promise<VariantOutcome> => {
      const made = await makeVariants({ canvasId, nodeId: source.id, rects })
      if (!made.ok) return { ok: false, reason: made.reason }

      /*
       * One job per variant, unlike an ordinary multi-output request, so the
       * node and the job line up one to one. The change the agent named becomes
       * the label, which is the only place its reasoning is visible.
       */
      return {
        ok: true,
        nodes: made.nodeIds.map((id, at) => ({
          ...reservedNode(rects[at] ?? rects[0] ?? source),
          id,
          jobId: made.jobIds[at] ?? null,
          label: made.changes[at] ?? null,
        })),
      }
    },
    [canvasId],
  )

  return { reserve, send }
}

/**
 * An empty rectangle in the generating state.
 *
 * Its id is deliberately not uuid-shaped. Nothing with this id exists in the
 * database yet, and a temporary id that looks like a real one is a temporary id
 * somebody will eventually send to the server.
 */
let held = 0
function reservedNode(rect: Rect): CanvasNodeView {
  held += 1
  return {
    id: `reserved-v${held}`,
    assetId: null,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    jobId: null,
    status: 'pending',
    kind: null,
    label: null,
    url: null,
    durationMs: null,
    error: null,
  }
}
