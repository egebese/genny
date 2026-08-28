'use client'

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
 */
export function useVariants(projectId: string, nodes: CanvasNodeView[]) {
  return useCallback(
    async (source: CanvasNodeView): Promise<VariantOutcome> => {
      const size = nodeSize(source)
      const footprint = rowFootprint(size, VARIANT_COUNT)
      const anchor = {
        ...placeFree(nodes, { x: source.x, y: source.y + source.height + 24 }, footprint),
        ...size,
      }
      const rects = siblingRects(anchor, VARIANT_COUNT)

      const made = await makeVariants({ projectId, nodeId: source.id, rects })
      if (!made.ok) return { ok: false, reason: made.reason }

      /*
       * One job per variant, unlike an ordinary multi-output request, so the
       * node and the job line up one to one. The change the agent named becomes
       * the label, which is the only place its reasoning is visible.
       */
      return {
        ok: true,
        nodes: made.nodeIds.map((id, at) => ({
          id,
          assetId: null,
          ...(rects[at] ?? anchor),
          jobId: made.jobIds[at] ?? null,
          status: 'pending' as const,
          kind: null,
          label: made.changes[at] ?? null,
          url: null,
          durationMs: null,
          error: null,
        })),
      }
    },
    [projectId, nodes],
  )
}
