'use client'

import type { NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type CanvasNodeView, toNodeView } from '../node-view.ts'
import { isReserved } from '../reserved.ts'
import {
  removeNode,
  repositionNode,
  resizeNodeOnCanvas,
  settleJobOnCanvas,
} from '../server/actions.ts'
import { cancelGeneration } from '../server/cancel-generation.ts'
import { reconcile } from './reconcile.ts'
import { enqueue } from './write-queue.ts'

type Position = { x: number; y: number }

/**
 * The board's contents, and the four things that change them.
 *
 * Moves are optimistic and written on release rather than on every frame: a
 * drag is thirty updates, twenty-nine of which nobody will ever read.
 */
export function useBoardNodes(
  canvasId: string,
  initial: CanvasNodeView[],
  onSettled: (nodes: CanvasNodeView[]) => void,
) {
  const [nodes, setNodes] = useState<CanvasNodeView[]>(initial)
  /*
   * Where everything being dragged started.
   *
   * A ref rather than state: it is read inside a pointermove and never drawn,
   * and putting it in state would re-render the board a second time on every
   * frame of a drag to no effect.
   */
  const anchored = useRef(new Map<string, Position>())

  /**
   * Everything moves together, and only the node under the pointer is snapped.
   *
   * The others follow by the same delta rather than being snapped themselves:
   * a selection is a shape, and snapping each member to whatever it happened to
   * pass would pull it apart on the way.
   */
  const beginDrag = useCallback((ids: readonly string[]) => {
    setNodes((current) => {
      anchored.current = new Map(
        current
          .filter((node) => ids.includes(node.id))
          .map((node) => [node.id, { x: node.x, y: node.y }]),
      )
      return current
    })
  }, [])

  const move = useCallback((id: string, position: Position) => {
    setNodes((current) => {
      const from = anchored.current.get(id)
      // Dragged on its own, or dragged before anything was anchored.
      if (!from || anchored.current.size < 2) {
        return current.map((node) => (node.id === id ? { ...node, ...position } : node))
      }
      const delta = { x: position.x - from.x, y: position.y - from.y }
      return current.map((node) => {
        const start = anchored.current.get(node.id)
        return start ? { ...node, x: start.x + delta.x, y: start.y + delta.y } : node
      })
    })
  }, [])

  const commit = useCallback(
    (id: string, position: Position) => {
      move(id, position)
      const from = anchored.current.get(id)
      const delta = from ? { x: position.x - from.x, y: position.y - from.y } : null

      if (!delta || anchored.current.size < 2) {
        void enqueue(id, () => repositionNode({ canvasId, nodeId: id, ...position }))
      } else {
        for (const [nodeId, start] of anchored.current) {
          void enqueue(nodeId, () =>
            repositionNode({ canvasId, nodeId, x: start.x + delta.x, y: start.y + delta.y }),
          )
        }
      }
      anchored.current = new Map()
    },
    [move, canvasId],
  )

  /** Live while the corner is dragged; `sized` is what gets written. */
  const size = useCallback((id: string, next: { width: number; height: number }) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...next } : node)))
  }, [])

  const sized = useCallback(
    (id: string, next: { width: number; height: number }) => {
      size(id, next)
      void enqueue(id, () => resizeNodeOnCanvas({ canvasId, nodeId: id, ...next }))
    },
    [size, canvasId],
  )

  const remove = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id))
      void enqueue(id, () => removeNode({ canvasId, nodeId: id }))
    },
    [canvasId],
  )

  const add = useCallback((added: CanvasNodeView[]) => {
    setNodes((current) => [...current, ...added])
  }, [])

  /**
   * Swaps the rectangles reserved on click for the rows the server wrote.
   *
   * The coordinates are the same on both sides, so nothing moves: what changes
   * is that the boxes now have ids and a job, which is what opens their stream.
   * An empty replacement is the failure case, and takes them back off.
   */
  const replace = useCallback((reserved: readonly string[], real: CanvasNodeView[]) => {
    setNodes((current) => [...current.filter((node) => !reserved.includes(node.id)), ...real])
  }, [])

  /**
   * Takes a whole board back from the server.
   *
   * Actions that add rows return every row they know about rather than a diff,
   * because it is one query and never wrong. What the server does not know
   * about is a rectangle another generation is still holding: those exist only
   * here until their own request returns. Replacing the list outright wiped
   * them, so firing a second generation while the first was running made its
   * boxes vanish and come back.
   */
  const absorb = useCallback(
    (fresh: NodeRecord[]) => {
      // Empty means the board is gone or nothing was written; either way the
      // local state is the better of the two.
      if (fresh.length === 0) return
      const views = fresh.map(toNodeView)
      setNodes((current) => [...current.filter(isReserved), ...views])
      // What just landed is mentionable now. Nothing else tells the dock that.
      onSettled(views)
    },
    [onSettled],
  )

  const settle = useCallback(
    (jobId: string) => reconcile(async () => absorb(await settleJobOnCanvas({ canvasId, jobId }))),
    [canvasId, absorb],
  )

  /** Giving up on a running generation. Same shape as settling one: the server
   * hands back the board and the local list is replaced by it. */
  const cancel = useCallback(
    (jobId: string) => reconcile(async () => absorb(await cancelGeneration({ canvasId, jobId }))),
    [canvasId, absorb],
  )

  /** One open stream per unfinished generation, and no duplicates. */
  const running = useMemo(
    () => [
      ...new Set(
        nodes
          .filter((node) => node.status === 'pending' && node.jobId !== null)
          .map((node) => node.jobId as string),
      ),
    ],
    [nodes],
  )

  return {
    nodes,
    running,
    beginDrag,
    move,
    commit,
    size,
    sized,
    remove,
    add,
    replace,
    absorb,
    settle,
    cancel,
  }
}
