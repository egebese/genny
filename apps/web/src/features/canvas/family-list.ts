import type { MediaKind } from '@genny/models/aspect.ts'
import { familyAccepts, resolveTask } from '@genny/models/family.ts'
import type { PickableModel } from './model-list.ts'

export type PickableFamily = {
  id: string
  name: string
  modality: PickableModel['modality']
  /** What the card says it does: the plainest task's own group. */
  group: string
  /**
   * Every category this model belongs in, one per endpoint it has.
   *
   * A family is not one thing. Kling writes video from a prompt and animates a
   * still, and filing it only under the first meant the picker had an Image to
   * Video heading with nothing under it while four models could do exactly
   * that. The categories are capabilities, not a label each model gets one of.
   */
  groups: string[]
  artUrl: string | null
  markUrl: string | null
  priceLabel: string
  /** Every kind this model can take, across all of its endpoints. */
  accepts: MediaKind[]
  /**
   * Other words this model answers to, beside its name.
   *
   * The picker matched the name and the group, which is fine at a dozen models
   * and useless at thirty-five families: no lab could be searched for at all,
   * and a family whose tasks are named on its other endpoints could not be
   * found by what those tasks are.
   */
  keywords: string[]
  /** Its endpoints, in catalog order. The picker never shows these. */
  variants: PickableModel[]
}

/**
 * The catalog as models rather than as URLs.
 *
 * The picker used to list endpoints, so Nano Banana 2 appeared twice and one of
 * the two could truthfully say it takes no image. A model appears once now and
 * the endpoint is worked out from what you hand it.
 *
 * The card's group and price come from the plainest task in the family, the one
 * that needs nothing handed over, because that is the one someone is choosing
 * when they choose the model.
 */
export function toFamilies(models: PickableModel[]): PickableFamily[] {
  const grouped = new Map<string, PickableModel[]>()
  for (const model of models) {
    const list = grouped.get(model.family.id)
    if (list) list.push(model)
    else grouped.set(model.family.id, [model])
  }

  return [...grouped.values()].map((variants) => {
    /*
     * The card describes what this model does when handed nothing, decided by
     * the resolver that decides what actually runs. Not a second rule: any
     * other reading of "the plainest task" is one more thing to drift.
     *
     * "The first member that needs nothing handed over" was that other reading,
     * and it filed Wan 2.7 under Reference to Video. Its reference endpoint
     * takes an image without insisting on one and sorts long before its text
     * endpoint, so it won a race it was never in.
     */
    const base = resolveTask(variants, []) ?? variants[0]
    if (!base) throw new Error('a family with no members cannot exist')
    return {
      id: base.family.id,
      name: base.family.name,
      modality: base.modality,
      group: base.group,
      groups: [...new Set(variants.map((variant) => variant.group))],
      artUrl: base.artUrl,
      markUrl: base.markUrl,
      priceLabel: base.priceLabel,
      accepts: familyAccepts(variants),
      keywords: keywordsOf(variants),
      variants,
    }
  })
}

/**
 * The words that should find this model, beside its name.
 *
 * Keywords rather than a longer `value`, which is the seam cmdk offers for
 * exactly this: it scores what it matched against the length of the value, so
 * stuffing every word into that string does not add a way to find a model, it
 * dilutes every other way. Searching "upscale" with a stuffed value ranked
 * Ideogram above the three models with the word in their name.
 *
 * The endpoint ids carry the lab, which is how "google", "bytedance" and
 * "blackforestlabs" become searchable without a field for it; the groups carry
 * every task the family has, not only its plainest one.
 */
function keywordsOf(variants: readonly PickableModel[]): string[] {
  const words = new Set<string>()
  for (const variant of variants) {
    const parts = [variant.group, variant.modality, variant.endpointId.replace(/[/_.-]+/g, ' ')]
    for (const word of parts.join(' ').toLowerCase().split(/\s+/)) {
      if (word.length > 1) words.add(word)
    }
  }
  return [...words]
}

/** The endpoint to send to, given what is attached. Null when nothing fits. */
export function taskFor(family: PickableFamily, given: readonly MediaKind[]) {
  return resolveTask(family.variants, given)
}
