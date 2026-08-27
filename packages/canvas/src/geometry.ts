export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = Point & Size

/**
 * Pan in screen pixels and a scale factor, applied in that order:
 * `translate(x, y) scale(zoom)`. One CSS transform on the wrapper moves the
 * whole board, so panning costs nothing per node.
 */
export type Viewport = Point & { zoom: number }

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function toScreen(point: Point, viewport: Viewport): Point {
  return { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y }
}

export function toCanvas(point: Point, viewport: Viewport): Point {
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom }
}

/**
 * Zooms so the canvas point under the cursor stays under the cursor.
 *
 * Anything else makes the board slide away while you are trying to look closer,
 * which reads as the app fighting you rather than as zoom.
 */
export function zoomAt(viewport: Viewport, cursor: Point, factor: number): Viewport {
  const zoom = clampZoom(viewport.zoom * factor)
  const applied = zoom / viewport.zoom
  return {
    zoom,
    x: cursor.x - (cursor.x - viewport.x) * applied,
    y: cursor.y - (cursor.y - viewport.y) * applied,
  }
}

/** The viewport that frames `rects` inside a viewport of `size`, with padding. */
export function fitTo(rects: Rect[], size: Size, padding = 80): Viewport {
  const bounds = boundsOf(rects)
  if (!bounds || size.width <= 0 || size.height <= 0) return { x: 0, y: 0, zoom: 1 }

  const zoom = clampZoom(
    Math.min(
      (size.width - padding * 2) / Math.max(bounds.width, 1),
      (size.height - padding * 2) / Math.max(bounds.height, 1),
      // Never zoom past 1:1 just because the board holds one small thing.
      1,
    ),
  )
  return {
    zoom,
    x: size.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: size.height / 2 - (bounds.y + bounds.height / 2) * zoom,
  }
}

export function boundsOf(rects: Rect[]): Rect | null {
  const first = rects[0]
  if (!first) return null
  let left = first.x
  let top = first.y
  let right = first.x + first.width
  let bottom = first.y + first.height
  for (const rect of rects) {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** The canvas rectangle currently on screen, for culling what is far off it. */
export function visibleRect(viewport: Viewport, size: Size): Rect {
  const origin = toCanvas({ x: 0, y: 0 }, viewport)
  return {
    x: origin.x,
    y: origin.y,
    width: size.width / viewport.zoom,
    height: size.height / viewport.zoom,
  }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}
