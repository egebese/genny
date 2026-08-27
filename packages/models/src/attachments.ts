import type { ModelDefinition } from './schema.ts'
import { allSlots } from './slots.ts'

export type ResolvedAttachment = { field: string; url: string }

export type AppliedAttachments = {
  /** Fields to merge into the payload, after the prompt has had its turn. */
  patch: Record<string, unknown>
  /** Attachments the model has no slot for, or no room left in one. Never silent. */
  dropped: string[]
}

/**
 * Puts explicitly pinned assets into the fields they were pinned to.
 *
 * Applied after `resolvePrompt` and allowed to overwrite it: a person who
 * right-clicked "use as end frame" has said something the prompt cannot say, and
 * the mapping's field order was only ever a guess at what they meant.
 *
 * Still checked against the catalog. The field name arrives from a browser, and
 * an unknown one would otherwise become a payload key the endpoint answers 422
 * for, with a reason nobody can see.
 */
export function applyAttachments(
  model: ModelDefinition,
  attachments: readonly ResolvedAttachment[],
): AppliedAttachments {
  const slots = new Map(allSlots(model).map((slot) => [slot.field, slot]))
  const patch: Record<string, unknown> = {}
  const dropped: string[] = []

  for (const attachment of attachments) {
    const slot = slots.get(attachment.field)
    if (!slot) {
      dropped.push(attachment.field)
      continue
    }

    if (!slot.array) {
      // Last one wins rather than first: re-picking a start frame is how someone
      // corrects the one they just picked.
      patch[slot.field] = attachment.url
      continue
    }

    const current = Array.isArray(patch[slot.field]) ? (patch[slot.field] as string[]) : []
    if (current.length >= slot.maxCount) {
      dropped.push(attachment.field)
      continue
    }
    patch[slot.field] = [...current, attachment.url]
  }

  return { patch, dropped }
}
