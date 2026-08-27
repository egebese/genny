'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { type CanvasNodeView, toNodeView } from '../node-view.ts'
import { removeNode, repositionNode, settleJobOnCanvas } from '../server/actions.ts'

type Position = { x: number; y: number }

/**
 * The board's contents, and the four things that change them.
 *
 * Moves are optimistic and written on release rather than on every frame: a
 * drag is thirty updates, twenty-nine of which nobody will ever read.
 */
export function useBoardNodes(
  projectId: string,
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
        void repositionNode({ projectId, nodeId: id, ...position })
      } else {
        for (const [nodeId, start] of anchored.current) {
          void repositionNode({
            projectId,
            nodeId,
            x: start.x + delta.x,
            y: start.y + delta.y,
          })
        }
      }
      anchored.current = new Map()
    },
    [move, projectId],
  )

  const remove = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id))
      void removeNode({ projectId, nodeId: id })
    },
    [projectId],
  )

  const add = useCallback((added: CanvasNodeView[]) => {
    setNodes((current) => [...current, ...added])
  }, [])

  const settle = useCallback(
    async (jobId: string) => {
      const fresh = await settleJobOnCanvas({ projectId, jobId })
      // An empty answer means the board is gone or the job produced nothing;
      // either way the local state is the better of the two.
      if (fresh.length === 0) return
      const views = fresh.map(toNodeView)
      setNodes(views)
      // What just landed is mentionable now. Nothing else tells the dock that.
      onSettled(views)
    },
    [projectId, onSettled],
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

  return { nodes, running, beginDrag, move, commit, remove, add, settle }
}
