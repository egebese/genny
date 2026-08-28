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

/**
 * Variants of one node.
 *
 * The rectangles come from the browser for the same reason a generation's does:
 * only it knows the viewport and what is already placed. The count is their
 * length rather than a field of its own, because two numbers that have to agree
 * are one number and a bug.
 */
export const variantRequest = z.object({
  projectId: z.uuid(),
  nodeId: z.uuid(),
  rects: z
    .array(
      z.object({
        x: coordinate,
        y: coordinate,
        width: z.int().positive().max(4000),
        height: z.int().positive().max(4000),
      }),
    )
    .min(1)
    .max(8),
})

export type VariantRequest = z.infer<typeof variantRequest>

export type CreateProjectRequest = z.infer<typeof createProjectRequest>
export type SaveViewportRequest = z.infer<typeof saveViewportRequest>
export type MoveNodeRequest = z.infer<typeof moveNodeRequest>
