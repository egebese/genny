import type { Rect } from '@genny/canvas/geometry.ts'
import type { CanvasNodeView } from './node-view.ts'

/**
 * A rectangle held on the board while a request is in flight.
 *
 * The id is deliberately not uuid-shaped, and that shape is what everything
 * else keys off. Nothing with this id exists in the database, so anything that
 * replaces the board from the server has to leave these alone: a job settling
 * used to hand back every row it knew about and wipe the rectangles another
 * generation was still holding.
 */
const PREFIX = 'reserved-'

let held = 0

export function reservedNode(rect: Rect): CanvasNodeView {
  held += 1
  return {
    id: `${PREFIX}${held}`,
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

export function isReserved(node: { id: string }): boolean {
  return node.id.startsWith(PREFIX)
}
