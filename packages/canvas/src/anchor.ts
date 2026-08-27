import type { Point, Rect, Size } from './geometry.ts'

/**
 * Where a panel goes so it reads as belonging to `node` without covering it or
 * falling off the screen.
 *
 * Right of the node first, left if that would overflow, and pinned inside the
 * viewport if neither fits. The panel is positioned in screen pixels rather than
 * on the board on purpose: hung on the canvas it would shrink with the zoom, and
 * a payload nobody can read is not a detail view.
 */
export function anchorPanel(node: Rect, panel: Size, bounds: Size, gap = 12): Point {
  const right = node.x + node.width + gap
  const left = node.x - panel.width - gap

  const x =
    right + panel.width <= bounds.width
      ? right
      : left >= 0
        ? left
        : clamp(node.x, gap, bounds.width - panel.width - gap)

  return { x, y: clamp(node.y, gap, bounds.height - panel.height - gap) }
}

/** Never returns a value below `low`, even when the space is smaller than the panel. */
function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)))
}
