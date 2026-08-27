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
  x: number
  y: number
  width: number
  height: number
  jobId: string | null
  status: 'pending' | 'ready' | 'failed'
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
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    jobId: node.jobId,
    // The asset decides, not the job: a job can be marked completed a moment
    // before its outputs are ingested, and a node without media is not ready
    // however green the job row looks.
    status: media
      ? 'ready'
      : node.status === 'failed' || node.status === 'canceled'
        ? 'failed'
        : 'pending',
    kind: node.kind,
    label: node.label,
    url: media,
    durationMs: node.durationMs,
    error: node.error,
  }
}
