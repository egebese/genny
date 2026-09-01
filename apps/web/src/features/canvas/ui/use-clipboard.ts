'use client'

import { type Clipping, centredIn, movedTo, nudged } from '@genny/canvas/clipboard.ts'
import { type Point, toCanvas } from '@genny/canvas/geometry.ts'
import { clipboardContents } from '@genny/canvas/requests.ts'
import type { NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'
import { useCallback, useEffect, useState } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { pasteNodes } from '../server/node-actions.ts'
import type { useViewport } from './use-viewport.ts'

const KEY = 'genny:clipboard'

type Options = {
  canvasId: string
  nodes: CanvasNodeView[]
  /** Read at key time, so the shortcuts act on what is picked right now. */
  selected: ReadonlySet<string>
  view: ReturnType<typeof useViewport>
  absorb: (fresh: NodeRecord[]) => void
  remove: (ids: string[]) => void
}

/**
 * Copy, cut, paste and duplicate, for nodes.
 *
 * What is copied is a reference and a rectangle, never the picture. A paste is
 * a second node pointing at the same asset, which is why duplicating a clip is
 * instant and free where re-uploading it would be neither.
 *
 * The clipboard is `sessionStorage` rather than the system one. It survives
 * moving between boards and reloading the tab, which is the case that matters:
 * copying from one canvas and pasting into another. It deliberately does not
 * touch the real clipboard, so copying a node does not throw away whatever text
 * was on it.
 */
export function useClipboard({ canvasId, nodes, selected, view, absorb, remove }: Options) {
  const [filled, setFilled] = useState(() => read().length > 0)

  const copy = useCallback(
    (ids: readonly string[]) => {
      // A placeholder has nothing to point at yet. Copying one would paste an
      // empty box that never fills, since it belongs to a job it is not part of.
      const taken = clippingsOf(nodes, ids)
      if (taken.length === 0) return false
      write(taken)
      setFilled(true)
      return true
    },
    [nodes],
  )

  const cut = useCallback(
    (ids: readonly string[]) => {
      if (copy(ids)) remove([...ids])
    },
    [copy, remove],
  )

  /** `at` is board-relative screen pixels, the way the menu records a click. */
  const paste = useCallback(
    async (at?: Point) => {
      const held = read()
      if (held.length === 0) return
      const placed = at
        ? movedTo(held, toCanvas(at, view.current.current))
        : centredIn(held, view.visibleRect())
      absorb(await pasteNodes({ canvasId, items: placed }))
    },
    [canvasId, view, absorb],
  )

  const duplicate = useCallback(
    async (ids: readonly string[]) => {
      const chosen = clippingsOf(nodes, ids)
      if (chosen.length === 0) return
      absorb(await pasteNodes({ canvasId, items: nudged(chosen) }))
    },
    [canvasId, nodes, absorb],
  )

  /*
   * The shortcuts everyone already knows, on the window rather than on the
   * board, so they work whether or not a node happens to hold focus.
   *
   * Nothing fires while a text field has it: the dock is a textarea and the
   * whole point of it is that the usual keys mean the usual things there.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return
      }

      const ids = [...selected]
      if (event.key === 'v') void paste()
      else if (ids.length === 0) return
      else if (event.key === 'c') copy(ids)
      else if (event.key === 'x') cut(ids)
      else if (event.key === 'd') void duplicate(ids)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, copy, cut, paste, duplicate])

  return { filled, copy, cut, paste, duplicate }
}

/**
 * The picked nodes as clippings.
 *
 * A placeholder is dropped rather than carried: it has nothing to point at yet,
 * and pasting one would put an empty box on the board belonging to a job it is
 * not part of, which would never fill.
 */
function clippingsOf(nodes: readonly CanvasNodeView[], ids: readonly string[]): Clipping[] {
  return nodes.flatMap((node) =>
    ids.includes(node.id) && node.assetId
      ? [{ assetId: node.assetId, x: node.x, y: node.y, width: node.width, height: node.height }]
      : [],
  )
}

/** A malformed or hand-edited value is an empty clipboard, not a crash. */
function read(): Clipping[] {
  try {
    const parsed = clipboardContents.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function write(items: Clipping[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Private windows and full quotas. Losing a paste beats losing the board.
  }
}
