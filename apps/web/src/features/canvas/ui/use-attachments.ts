'use client'

import { resolveTask } from '@genny/models/family.ts'
import { reassign } from '@genny/models/reassign.ts'
import { slotsAccepting } from '@genny/models/slots.ts'
import { useCallback, useState } from 'react'
import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import type { Attachment } from './attachment-strip.tsx'

/**
 * The least a thing has to be to be attached: it exists as an asset, we know
 * what kind of media it is, and we can show it.
 *
 * A node on the board satisfies this once it has finished, and so does an item
 * pinned to the project, which is not a node and never will be. The nullable
 * fields are the board's: a running node has no asset yet.
 */
export type Attachable = {
  assetId: string | null
  label: string | null
  url: string | null
  kind: 'image' | 'video' | 'audio' | null
}

/**
 * Assets pinned to named model inputs.
 *
 * Cleared when the model changes, because the fields do: a start frame pinned to
 * `image_url` on one endpoint is meaningless on the next, and carrying it over
 * would send it somewhere nobody asked for.
 */
/** The set, placed on whichever endpoint of `family` this many of them reach. */
function lay(items: Attachment[], family: PickableFamily): Attachment[] {
  if (items.length === 0) return items
  const target = resolveTask(
    family.variants,
    items.map((item) => item.kind),
  )
  const slots = new Map((target?.slots ?? []).map((slot) => [slot.field, slot]))
  const fields = reassign(items, target?.slots ?? [])

  return items
    .map((item, at) => {
      const slot = slots.get(fields[at] ?? '')
      return slot ? { ...item, field: slot.field, slotLabel: slot.label } : null
    })
    .filter((item) => item !== null)
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const attach = useCallback(
    (model: PickableModel, field: string, nodes: readonly Attachable[]) => {
      const slot = model.slots.find((candidate) => candidate.field === field)
      if (!slot) return

      setAttachments((current) => {
        type Ready = Attachable & {
          kind: NonNullable<Attachable['kind']>
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
    },
    [],
  )

  /**
   * Lay the whole set out again, in the order it was added.
   *
   * Called after every change rather than only on a model change, because
   * adding one can move the others: a second image on PixVerse takes the model
   * from its animator to its transition, and the first image stops being "the
   * image" and becomes the first frame.
   */
  const relayout = useCallback(
    (family: PickableFamily) => setAttachments((current) => lay(current, family)),
    [],
  )

  const remove = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, at) => at !== index))
  }, [])

  const clear = useCallback(() => setAttachments([]), [])

  /**
   * Carry what is attached over to a different model.
   *
   * Changing the model used to drop everything, on the reasoning that a pin to
   * `image_url` means nothing on an endpoint without that field. True, and the
   * conclusion was wrong: what someone attached is what they want to work with,
   * and the field is our bookkeeping to redo.
   *
   * The endpoint is resolved from what is being carried, so two images reach
   * whichever task in the new model wants two, and then each item is offered
   * the slots in the order the catalog declares them.
   */
  const moveTo = useCallback((family: PickableFamily) => {
    setAttachments((current) => {
      if (current.length === 0) return current
      const target = resolveTask(
        family.variants,
        current.map((item) => item.kind),
      )
      const fields = reassign(current, target?.slots ?? [])
      const slots = new Map((target?.slots ?? []).map((slot) => [slot.field, slot]))

      return current
        .map((item, at) => {
          const field = fields[at]
          const slot = field === null || field === undefined ? undefined : slots.get(field)
          return slot ? { ...item, field: slot.field, slotLabel: slot.label } : null
        })
        .filter((item) => item !== null)
    })
  }, [])

  /** What the request carries: field and id, nothing the server would not check. */
  const forRequest = useCallback(
    () => attachments.map((item) => ({ field: item.field, assetId: item.assetId })),
    [attachments],
  )

  /** True when this model has anywhere at all to put media of these kinds. */
  const canTake = useCallback(
    (model: PickableModel, nodes: readonly Attachable[]) =>
      nodes.some((node) => node.kind && slotsAccepting(model.slots, node.kind).length > 0),
    [],
  )

  return { attachments, attach, remove, clear, moveTo, relayout, forRequest, canTake }
}
