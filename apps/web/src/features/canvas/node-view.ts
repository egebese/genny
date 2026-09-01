import type { MediaKind } from '@genny/assets/media.ts'
import { assetUrl } from '@genny/assets/urls.ts'
import type { NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'

/**
 * One node as the board draws it. Everything the browser needs and nothing it
 * does not: the storage key stays on the server, only the url it resolves to
 * crosses over.
 */
export type CanvasNodeView = {
  id: string
  /** Null while the generation is running. Needed to pin the result to an input. */
  assetId: string | null
  x: number
  y: number
  width: number
  height: number
  jobId: string | null
  /**
   * `missing` is the one worth explaining: the node points at media that is not
   * there any more, or never arrived. Its asset was deleted, or ingestion failed
   * and the fal urls behind it expired. It used to collapse into `pending`, so a
   * node whose picture was gone forever showed a spinner that would never stop.
   */
  status: 'pending' | 'ready' | 'failed' | 'missing'
  kind: MediaKind | null
  label: string | null
  url: string | null
  durationMs: number | null
  error: string | null
}

export function toNodeView(node: NodeRecord): CanvasNodeView {
  const media =
    node.assetId && node.label && node.storageKey
      ? assetUrl({ id: node.assetId, label: node.label, storageKey: node.storageKey })
      : null

  return {
    id: node.id,
    assetId: node.assetId,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    jobId: node.jobId,
    // The asset decides, not the job: a job can be marked completed a moment
    // before its outputs are ingested, and a node without media is not ready
    // however green the job row looks.
    status: statusOf(node, media !== null),
    kind: node.kind,
    label: node.label,
    url: media,
    durationMs: node.durationMs,
    error: node.error,
  }
}

function statusOf(node: NodeRecord, hasMedia: boolean): CanvasNodeView['status'] {
  if (hasMedia) return 'ready'
  if (node.status === 'failed' || node.status === 'canceled') return 'failed'

  /*
   * Nothing more is coming. Either the job finished and its media is not here,
   * which means ingestion failed and fal's urls have since expired, or the node
   * names an asset that has since been deleted. Both used to read as `pending`,
   * and pending is a promise the board could not keep.
   */
  if (node.status === 'completed') return 'missing'
  if (node.assetId !== null) return 'missing'
  if (node.jobId === null) return 'missing'

  return 'pending'
}
