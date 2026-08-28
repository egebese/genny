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
 *
 * `given` is counted, not deduplicated, and the count is load-bearing: PixVerse
 * C1 has a transition endpoint insisting on two images and an image-to-video
 * endpoint taking one, and one image sent to the first is a 422 for the end
 * frame nobody gave it.
 */
export function resolveTask<T extends Slotted>(
  variants: readonly Task<T>[],
  given: readonly MediaKind[],
): T | null {
  const count = new Map<MediaKind, number>()
  for (const kind of given) count.set(kind, (count.get(kind) ?? 0) + 1)
  const kinds = [...count.keys()]

  const usable = variants.filter((variant) => {
    const takesEverything = kinds.every((kind) => slotsAccepting(variant.slots, kind).length > 0)
    const enoughOfEach = KINDS.every((kind) => requiredOf(variant, kind) <= (count.get(kind) ?? 0))
    return takesEverything && enoughOfEach
  })

  if (usable.length === 0) return null
  return (
    usable
      .slice()
      .sort(
        (a, b) =>
          uses(b, kinds) - uses(a, kinds) ||
          // Between two that both fit, the one asking for more of what is on
          // offer is the one being aimed at: two images mean the transition.
          b.required.length - a.required.length ||
          /*
           * Declared order, not the length of a URL. Kling V3 ships standard,
           * pro and master as one family with identical slots, so the first two
           * comparisons tie for all three and the winner used to be whichever
           * word was shortest. `sortOrder` is what the catalog author decides
           * and what the picker already shows them in.
           */
          a.sortOrder - b.sortOrder,
      )
      .at(0) ?? null
  )
}

const KINDS: MediaKind[] = ['image', 'video', 'audio']

/** Slots of this kind the endpoint refuses to run without. */
function requiredOf(variant: Task<Slotted>, kind: MediaKind): number {
  return variant.required.filter((slot) => slot.accepts.includes(kind)).length
}

/** How many of the given kinds this endpoint actually has somewhere to put. */
function uses(variant: Slotted, kinds: readonly MediaKind[]): number {
  return kinds.filter((kind) => slotsAccepting(variant.slots, kind).length > 0).length
}

/** Everything the model can take, across all of its endpoints. */
export function familyAccepts(variants: readonly Slotted[]): MediaKind[] {
  return KINDS.filter((kind) =>
    variants.some((variant) => slotsAccepting(variant.slots, kind).length > 0),
  )
}
