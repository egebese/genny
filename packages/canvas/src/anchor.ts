import type { Point, Rect, Size } from './geometry.ts'

/**
 * Where a panel goes so it reads as belonging to `node` without covering it or
 * falling off the screen.
 *
 * Right of the node first, then left, then below it, then above. The panel is
 * positioned in screen pixels rather than on the board on purpose: hung on the
 * canvas it would shrink with the zoom, and a payload nobody can read is not a
 * detail view.
 *
 * The below and above fallbacks are what a narrow screen needs. When neither
 * side fitted, this used to clamp x into the viewport, which on a phone slides
 * the panel straight over the node it is describing: the one thing it must not
 * cover. Stacking it under the node keeps both visible and keeps the panel
 * anchored, which is what makes it a panel rather than a sheet.
 */
export function anchorPanel(node: Rect, panel: Size, bounds: Size, gap = 12): Point {
  const right = node.x + node.width + gap
  const left = node.x - panel.width - gap
  const insideY = clamp(node.y, gap, bounds.height - panel.height - gap)

  if (right + panel.width <= bounds.width) return { x: right, y: insideY }
  if (left >= 0) return { x: left, y: insideY }

  // Centred on the node horizontally, then pulled back inside: a panel wider
  // than the board still starts at the gap rather than off the left edge.
  const x = clamp(node.x + node.width / 2 - panel.width / 2, gap, bounds.width - panel.width - gap)

  const below = node.y + node.height + gap
  if (below + panel.height <= bounds.height) return { x, y: below }

  const above = node.y - panel.height - gap
  return { x, y: above >= gap ? above : insideY }
}

/** Never returns a value below `low`, even when the space is smaller than the panel. */
function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)))
}
