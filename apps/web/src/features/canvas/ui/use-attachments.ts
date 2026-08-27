'use client'

import { slotsAccepting } from '@genny/models/slots.ts'
import { useCallback, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { Attachment } from './attachment-strip.tsx'

/**
 * Assets pinned to named model inputs.
 *
 * Cleared when the model changes, because the fields do: a start frame pinned to
 * `image_url` on one endpoint is meaningless on the next, and carrying it over
 * would send it somewhere nobody asked for.
 */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const attach = useCallback((model: PickableModel, field: string, nodes: CanvasNodeView[]) => {
    const slot = model.slots.find((candidate) => candidate.field === field)
    if (!slot) return

    setAttachments((current) => {
      type Ready = CanvasNodeView & {
        kind: NonNullable<CanvasNodeView['kind']>
        url: string
        assetId: string
      }
      const usable = nodes.filter(
        (node): node is Ready =>
          node.kind !== null &&
          node.url !== null &&
          node.assetId !== null &&
          slot.accepts.includes(node.kind),
      )
      // A single slot holds one thing, so re-picking replaces rather than
      // stacking. An array slot keeps what is there and tops up to its limit.
      const kept = slot.array ? current : current.filter((item) => item.field !== field)
      const room = slot.maxCount - kept.filter((item) => item.field === field).length

      return [
        ...kept,
        ...usable.slice(0, Math.max(0, room)).map((node) => ({
          field,
          assetId: node.assetId,
          slotLabel: slot.label,
          label: node.label ?? 'result',
          url: node.url,
          kind: node.kind,
        })),
      ]
    })
  }, [])

  const remove = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, at) => at !== index))
  }, [])

  const clear = useCallback(() => setAttachments([]), [])

  /** What the request carries: field and id, nothing the server would not check. */
  const forRequest = useCallback(
    () => attachments.map((item) => ({ field: item.field, assetId: item.assetId })),
    [attachments],
  )

  /** True when this model has anywhere at all to put media of these kinds. */
  const canTake = useCallback(
    (model: PickableModel, nodes: CanvasNodeView[]) =>
      nodes.some((node) => node.kind && slotsAccepting(model.slots, node.kind).length > 0),
    [],
  )

  return { attachments, attach, remove, clear, forRequest, canTake }
}
