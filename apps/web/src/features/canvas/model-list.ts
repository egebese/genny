import type { ModelDefinition, ModelInput } from '@genny/models/schema.ts'
import { allSlots, type ReferenceSlot } from '@genny/models/slots.ts'

/**
 * What the picker and the dock need to know about a model. Deliberately not the
 * whole ModelDefinition: this crosses to the client, and the catalog carries
 * fields (reference mapping, capabilities) the browser has no business deciding.
 */
export type PickableModel = {
  endpointId: string
  /** The model this endpoint is one task of. The picker shows families. */
  family: { id: string; name: string }
  /** Slots this endpoint refuses to run without, so the resolver can skip it. */
  required: ReferenceSlot[]
  modality: ModelDefinition['modality']
  displayName: string
  /** One line on what the model is for. Shown under the name in the picker. */
  description: string
  group: string
  /** The card's backdrop, when one has been generated for this model. */
  artUrl: string | null
  /** The provider mark alone, for the card and the dock chip. */
  markUrl: string | null
  priceLabel: string
  pricing: ModelDefinition['pricing']
  /** On the client so the button can price the request without a round trip. */
  creditMultiplier: number
  /** Which input carries the prompt, so the rest can be listed without it. */
  promptField: string
  inputs: ModelInput[]
  /**
   * Where media can be pinned on this model. Crosses to the client whole,
   * because the right-click menu is built from it: a model added next month
   * brings its own menu items and the board learns nothing new.
   */
  slots: ReferenceSlot[]
  acceptsReferences: boolean
  /** True when the endpoint refuses to run without one. */
  requiresReference: boolean
  featured: boolean
  /** Which of two endpoints that both fit gets picked. Not for display. */
  sortOrder: number
}

export function toPickable(model: ModelDefinition): PickableModel {
  return {
    endpointId: model.endpointId,
    family: model.family,
    required: allSlots(model).filter((slot) => slot.required),
    modality: model.modality,
    displayName: model.displayName,
    description: model.description,
    group: model.group,
    artUrl: model.artUrl ?? null,
    markUrl: model.markUrl ?? null,
    // Singular: the unit vocabulary is plural because it names a quantity, and
    // this names one of them. "$0.07 / seconds" is a per-what nobody can read.
    priceLabel: `$${model.pricing.unitPriceUsd} / ${model.pricing.unit.replace(/s$/, '')}`,
    pricing: model.pricing,
    creditMultiplier: model.creditMultiplier,
    promptField: model.promptField,
    // The prompt has the dock's textarea; rendering it again as a setting gives
    // the model two places to read the same thing from and the person one too
    // many to fill in.
    inputs: model.inputs.filter((input) => !input.hidden && input.name !== model.promptField),
    slots: allSlots(model),
    acceptsReferences: model.references.length > 0,
    requiresReference: model.references.some((mapping) => mapping.required),
    featured: model.featured,
    sortOrder: model.sortOrder,
  }
}
