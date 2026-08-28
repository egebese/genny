import { z } from 'zod'

/**
 * What a browser may send to the canvas actions.
 *
 * Coordinates are bounded because a board is not infinite in practice: past a
 * million units the node is unreachable by any amount of panning, so a value out
 * there is a bug or an attack, never a person scrolling.
 */
const coordinate = z.int().min(-1_000_000).max(1_000_000)

export const canvasRef = z.object({ canvasId: z.uuid() })

export const createCanvasRequest = z.object({
  title: z.string().trim().min(1).max(120).default('Untitled'),
  /** Absent means the project they were last in. Naming one is the exception. */
  projectId: z.uuid().optional(),
})

export const renameCanvasRequest = z.object({
  canvasId: z.uuid(),
  title: z.string().trim().min(1).max(120),
})

export const saveViewportRequest = z.object({
  canvasId: z.uuid(),
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.1).max(4),
})

export const moveNodeRequest = z.object({
  canvasId: z.uuid(),
  nodeId: z.uuid(),
  x: coordinate,
  y: coordinate,
})

export const nodeRef = z.object({ canvasId: z.uuid(), nodeId: z.uuid() })

/** Bounded by the same rail as a node rect: past this it is a bug, not a resize. */
export const resizeNodeRequest = z.object({
  canvasId: z.uuid(),
  nodeId: z.uuid(),
  width: z.int().positive().max(4000),
  height: z.int().positive().max(4000),
})

export const materializeRequest = z.object({ canvasId: z.uuid(), jobId: z.uuid() })

/**
 * Placing copies of assets already on the board.
 *
 * Only the reference travels, never the bytes: a paste is a second node
 * pointing at the same asset, so copying a clip forty times costs forty rows.
 * The rectangles come from the browser because only it knows where the paste
 * was aimed, and they are bounded by the same rails as any other node.
 */
export const clippingSchema = z.object({
  assetId: z.uuid(),
  x: coordinate,
  y: coordinate,
  width: z.int().positive().max(4000),
  height: z.int().positive().max(4000),
})

/** The browser's own clipboard is storage anybody can edit, so it is parsed
 * with the same schema on the way out of it as on the way into the action. */
export const clipboardContents = z.array(clippingSchema).max(64)

export const pasteNodesRequest = z.object({
  canvasId: z.uuid(),
  items: z.array(clippingSchema).min(1).max(64),
})

/**
 * The project's own details.
 *
 * A hex list rather than free text for the palette: it is drawn as swatches and
 * handed to agents as colours, and "warm terracotta" is neither.
 */
export const saveProjectRequest = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().max(4000),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(12),
})

export type SaveProjectRequest = z.infer<typeof saveProjectRequest>

/** Pinning an asset to a project, or moving it between roles. */
export const pinAssetRequest = z.object({
  projectId: z.uuid(),
  assetId: z.uuid(),
  role: z.enum(['logo', 'product', 'reference']),
})

export const unpinAssetRequest = z.object({ projectId: z.uuid(), assetId: z.uuid() })

/**
 * One turn with the director.
 *
 * The selection travels with the question because it changes what is being
 * asked: three shots picked and "what is wrong with these" means those three,
 * and an unasked-for critique of the whole board is the answer nobody wanted.
 */
export const directorRequest = z.object({
  canvasId: z.uuid(),
  question: z.string().trim().min(1).max(2000),
  selected: z.array(z.uuid()).max(32).default([]),
})

export type DirectorRequest = z.infer<typeof directorRequest>

/**
 * Variants of one node.
 *
 * The rectangles come from the browser for the same reason a generation's does:
 * only it knows the viewport and what is already placed. The count is their
 * length rather than a field of its own, because two numbers that have to agree
 * are one number and a bug.
 */
export const variantRequest = z.object({
  canvasId: z.uuid(),
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

export type CreateCanvasRequest = z.infer<typeof createCanvasRequest>
export type SaveViewportRequest = z.infer<typeof saveViewportRequest>
export type MoveNodeRequest = z.infer<typeof moveNodeRequest>
