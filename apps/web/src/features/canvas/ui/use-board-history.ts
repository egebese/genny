'use client'

import {
  type BoardEdit,
  invert,
  type Restorable,
  resolvable,
  restorableOf,
  translated,
} from '@genny/canvas/history.ts'
import { emptyHistory, push, redo, undo } from '@genny/canvas/history-stack.ts'
import { useCallback, useRef } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { repositionNode, resizeNodeOnCanvas } from '../server/actions.ts'
import { restoreNodes } from '../server/node-actions.ts'
import type { useBoardNodes } from './use-board-nodes.ts'
import { enqueue } from './write-queue.ts'

type Board = ReturnType<typeof useBoardNodes>
type Rect = { x: number; y: number; width: number; height: number }

/**
 * The same board, with a memory.
 *
 * A decorator rather than a rewrite because `board` is already threaded through
 * every hook as one object, so wrapping it once covers all three places that
 * write: this hook, the clipboard, and generation.
 *
 * Only four of the eleven mutators are wrapped. `add`, `replace`, `absorb` and
 * `settle` pass straight through, which is how generation and materialisation
 * stay out of the history by construction rather than by a flag somebody has to
 * remember to set. Undoing a generation is not a thing this can offer honestly:
 * the credits are already spent.
 */
export function useBoardHistory(canvasId: string, board: Board) {
  const history = useRef(emptyHistory())
  const anchors = useRef(new Map<string, Rect>())
  // Holding cmd+z repeats. Without this, two applies of the same entry race and
  // the board flickers between two server snapshots.
  const busy = useRef(false)

  const beginDrag = useCallback(
    (ids: readonly string[]) => {
      anchors.current = new Map(
        board.nodes.filter((node) => ids.includes(node.id)).map((node) => [node.id, rectOf(node)]),
      )
      board.beginDrag(ids)
    },
    [board],
  )

  const commit = useCallback(
    (id: string, position: { x: number; y: number }) => {
      const moved = translated(anchors.current, id, position)
      const nodes = [...moved]
        .map(([nodeId, to]) => {
          const from = anchors.current.get(nodeId)
          return from ? { id: nodeId, from, to: { ...from, ...to } } : null
        })
        .filter((node) => node !== null)

      if (nodes.length > 0) history.current = push(history.current, { kind: 'geometry', nodes })
      board.commit(id, position)
    },
    [board],
  )

  const sized = useCallback(
    (id: string, next: { width: number; height: number }) => {
      const from = board.nodes.find((node) => node.id === id)
      if (from) {
        history.current = push(history.current, {
          kind: 'geometry',
          nodes: [{ id, from: rectOf(from), to: { ...rectOf(from), ...next } }],
        })
      }
      board.sized(id, next)
    },
    [board],
  )

  /** One entry for the whole selection, rather than one per node deleted. */
  const removeMany = useCallback(
    (ids: readonly string[]) => {
      const nodes = board.nodes
        .filter((node) => ids.includes(node.id))
        .map(restorableOf)
        .filter((node) => node !== null)

      if (nodes.length > 0) history.current = push(history.current, { kind: 'removal', nodes })
      for (const id of ids) board.remove(id)
    },
    [board],
  )

  /**
   * What a paste produced, told apart from what was already there.
   *
   * `pasteNodes` hands back the whole board rather than a diff, and the same
   * `absorb` is what a settling generation uses, so the ids that are new to
   * this call are the only signal that a person put them there.
   */
  const paste = useCallback(
    (fresh: Parameters<Board['absorb']>[0]) => {
      const before = new Set(board.nodes.map((node) => node.id))
      const nodes = fresh
        .filter((node) => !before.has(node.id))
        .map(restorableOf)
        .filter((node) => node !== null)

      if (nodes.length > 0) history.current = push(history.current, { kind: 'creation', nodes })
      board.absorb(fresh)
    },
    [board],
  )

  const apply = useCallback(
    async (edit: BoardEdit) => {
      const live = new Set(board.nodes.map((node) => node.id))
      const doable = resolvable(edit, live)
      if (!doable) return

      if (doable.kind === 'geometry') {
        for (const node of doable.nodes) {
          board.move(node.id, node.to)
          board.size(node.id, node.to)
          await enqueue(node.id, () =>
            Promise.all([
              repositionNode({ canvasId, nodeId: node.id, x: node.to.x, y: node.to.y }),
              resizeNodeOnCanvas({
                canvasId,
                nodeId: node.id,
                width: node.to.width,
                height: node.to.height,
              }),
            ]),
          )
        }
        return
      }

      if (doable.kind === 'removal') {
        for (const node of doable.nodes) board.remove(node.id)
        return
      }

      board.absorb(await restoreNodes({ canvasId, nodes: doable.nodes.map(toRequest) }))
    },
    [board, canvasId],
  )

  const step = useCallback(
    async (direction: 'undo' | 'redo') => {
      if (busy.current) return
      const taken = direction === 'undo' ? undo(history.current) : redo(history.current)
      if (!taken) return

      busy.current = true
      history.current = taken.history
      try {
        await apply(direction === 'undo' ? invert(taken.edit) : taken.edit)
      } finally {
        busy.current = false
      }
    },
    [apply],
  )

  return {
    ...board,
    beginDrag,
    commit,
    sized,
    removeMany,
    paste,
    undo: useCallback(() => step('undo'), [step]),
    redo: useCallback(() => step('redo'), [step]),
  }
}

function rectOf(node: CanvasNodeView): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

function toRequest(node: Restorable) {
  const { id, ...rest } = node
  return { nodeId: id, ...rest }
}
