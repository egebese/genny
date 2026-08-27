'use client'

import { useCallback, useMemo, useState } from 'react'
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

  const move = useCallback((id: string, position: Position) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...position } : node)))
  }, [])

  const commit = useCallback(
    (id: string, position: Position) => {
      move(id, position)
      void repositionNode({ projectId, nodeId: id, ...position })
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

  return { nodes, running, move, commit, remove, add, settle }
}
