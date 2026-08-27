import { z } from 'zod'

/**
 * What a browser may send to the canvas actions.
 *
 * Coordinates are bounded because a board is not infinite in practice: past a
 * million units the node is unreachable by any amount of panning, so a value out
 * there is a bug or an attack, never a person scrolling.
 */
const coordinate = z.int().min(-1_000_000).max(1_000_000)

export const projectRef = z.object({ projectId: z.uuid() })

export const createProjectRequest = z.object({
  title: z.string().trim().min(1).max(120).default('Untitled'),
})

export const renameProjectRequest = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(120),
})

export const saveViewportRequest = z.object({
  projectId: z.uuid(),
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.1).max(4),
})

export const moveNodeRequest = z.object({
  projectId: z.uuid(),
  nodeId: z.uuid(),
  x: coordinate,
  y: coordinate,
})

export const nodeRef = z.object({ projectId: z.uuid(), nodeId: z.uuid() })

export const materializeRequest = z.object({ projectId: z.uuid(), jobId: z.uuid() })

export type CreateProjectRequest = z.infer<typeof createProjectRequest>
export type SaveViewportRequest = z.infer<typeof saveViewportRequest>
export type MoveNodeRequest = z.infer<typeof moveNodeRequest>
