import type { MediaKind } from './aspect.ts'
import type { ReferenceSlot, Slotted } from './slots.ts'
import { slotsAccepting } from './slots.ts'

export type Task<T extends Slotted> = T & {
  /** Slots this endpoint refuses to run without. */
  required: readonly ReferenceSlot[]
}

/**
 * Which endpoint of a model to send this to.
 *
 * fal splits one model across endpoints by what you hand it, and the split is
 * an implementation detail of the URL rather than a choice anyone wants to
 * make: `fal-ai/nano-banana-2` writes from text, `fal-ai/nano-banana-2/edit`
 * works from an image, and both are Nano Banana 2. Putting both in the picker
 * let the product say "Nano Banana 2 takes no image" about a model that plainly
 * does.
 *
 * So the picker picks the model and this picks the endpoint, from what is
 * actually attached.
 *
 * Rules, in order:
 *   - an endpoint that cannot take one of these kinds is out
 *   - an endpoint that insists on a kind nobody gave it is out
 *   - of what remains, the one that uses the most of what was given wins, so
 *     handing over an image reaches the edit endpoint rather than the one that
 *     merely tolerates being handed nothing
 */
export function resolveTask<T extends Slotted>(
  variants: readonly Task<T>[],
  given: readonly MediaKind[],
): T | null {
  const kinds = [...new Set(given)]

  const usable = variants.filter((variant) => {
    const takesEverything = kinds.every((kind) => slotsAccepting(variant.slots, kind).length > 0)
    const nothingMissing = variant.required.every((slot) =>
      slot.accepts.some((kind) => kinds.includes(kind)),
    )
    return takesEverything && nothingMissing
  })

  if (usable.length === 0) return null
  return (
    usable
      .slice()
      .sort((a, b) => uses(b, kinds) - uses(a, kinds) || a.endpointId.length - b.endpointId.length)
      .at(0) ?? null
  )
}

/** How many of the given kinds this endpoint actually has somewhere to put. */
function uses(variant: Slotted, kinds: readonly MediaKind[]): number {
  return kinds.filter((kind) => slotsAccepting(variant.slots, kind).length > 0).length
}

/** Everything the model can take, across all of its endpoints. */
export function familyAccepts(variants: readonly Slotted[]): MediaKind[] {
  const kinds: MediaKind[] = ['image', 'video', 'audio']
  return kinds.filter((kind) =>
    variants.some((variant) => slotsAccepting(variant.slots, kind).length > 0),
  )
}
