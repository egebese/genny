import type { Rect, Size } from './geometry.ts'
import { NODE_LONG_EDGE } from './placement.ts'

/**
 * How small and how large a node is allowed to get.
 *
 * A third of the default is still legible as a thumbnail; four times it fills
 * most of a screen at 1:1. Past either end the node stops being a thing on a
 * board and becomes either a dot or the board itself.
 */
export const MIN_LONG_EDGE = Math.round(NODE_LONG_EDGE / 3)
export const MAX_LONG_EDGE = NODE_LONG_EDGE * 4

/**
 * The size a node becomes when its corner is dragged to `corner`.
 *
 * The aspect is kept, always. A node holds media that has an aspect of its own
 * and draws it with `object-cover`, so a free resize does not stretch the
 * picture, it crops it: the handle would silently be a cropping tool that
 * nobody asked for and nothing undoes.
 *
 * Driven by whichever axis the pointer moved furthest on, so dragging mostly
 * sideways widens and dragging mostly down heightens, and the corner keeps up
 * with the pointer in the direction it is actually going.
 */
export function resizedTo(node: Rect, corner: { x: number; y: number }): Size {
  const ratio = node.width / node.height
  const wanted = { width: corner.x - node.x, height: corner.y - node.y }

  const byWidth = Math.abs(wanted.width - node.width) >= Math.abs(wanted.height - node.height)
  const longEdge =
    ratio >= 1
      ? byWidth
        ? wanted.width
        : wanted.height * ratio
      : byWidth
        ? wanted.width / ratio
        : wanted.height

  return sizeFor(ratio, clampLongEdge(longEdge))
}

/** One step up or down, for the keyboard. A quarter of the default each time. */
export function resizedByStep(node: Rect, steps: number): Size {
  const ratio = node.width / node.height
  const current = ratio >= 1 ? node.width : node.height
  return sizeFor(ratio, clampLongEdge(current + steps * Math.round(NODE_LONG_EDGE / 4)))
}

function clampLongEdge(value: number): number {
  return Math.min(MAX_LONG_EDGE, Math.max(MIN_LONG_EDGE, Math.round(value)))
}

function sizeFor(ratio: number, longEdge: number): Size {
  return ratio >= 1
    ? { width: longEdge, height: Math.max(1, Math.round(longEdge / ratio)) }
    : { width: Math.max(1, Math.round(longEdge * ratio)), height: longEdge }
}
