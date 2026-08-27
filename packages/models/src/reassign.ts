import type { MediaKind } from './aspect.ts'
import type { ReferenceSlot } from './slots.ts'

/**
 * Where each attached item goes on a different model, in the order attached.
 *
 * Changing the model used to drop everything, on the reasoning that a pin to
 * `image_url` means nothing on an endpoint without that field. True, and the
 * conclusion was wrong: what someone attached is what they want to work with,
 * and the field is our bookkeeping.
 *
 * Order carries the intent. Slots are offered in the order the catalog declares
 * them, which is the order fal's own schema lists them, so one image lands on
 * the start frame and a second lands on the end frame rather than both fighting
 * over the first. An array slot swallows as many as its limit allows, which is
 * what makes two images on an editing model two references instead of two
 * halves of a transition.
 *
 * `null` for an item with nowhere to go: text to speech has no slots at all, and
 * carrying an image to it would be carrying it to a 422.
 */
export function reassign(
  items: readonly { kind: MediaKind }[],
  slots: readonly ReferenceSlot[],
): (string | null)[] {
  const used = new Map<string, number>()

  return items.map((item) => {
    const slot = slots.find((candidate) => {
      if (!candidate.accepts.includes(item.kind)) return false
      return (used.get(candidate.field) ?? 0) < candidate.maxCount
    })
    if (!slot) return null
    used.set(slot.field, (used.get(slot.field) ?? 0) + 1)
    return slot.field
  })
}
