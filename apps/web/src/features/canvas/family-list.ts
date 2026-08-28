import type { MediaKind } from '@genny/models/aspect.ts'
import { familyAccepts, resolveTask } from '@genny/models/family.ts'
import type { PickableModel } from './model-list.ts'

export type PickableFamily = {
  id: string
  name: string
  modality: PickableModel['modality']
  group: string
  artUrl: string | null
  markUrl: string | null
  priceLabel: string
  /** Every kind this model can take, across all of its endpoints. */
  accepts: MediaKind[]
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
      artUrl: base.artUrl,
      markUrl: base.markUrl,
      priceLabel: base.priceLabel,
      accepts: familyAccepts(variants),
      variants,
    }
  })
}

/** The endpoint to send to, given what is attached. Null when nothing fits. */
export function taskFor(family: PickableFamily, given: readonly MediaKind[]) {
  return resolveTask(family.variants, given)
}
