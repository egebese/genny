import type { ModelDefinition, ModelInput } from '@genny/models/schema.ts'

/**
 * What the picker and the dock need to know about a model. Deliberately not the
 * whole ModelDefinition: this crosses to the client, and the catalog carries
 * fields (reference mapping, capabilities) the browser has no business deciding.
 */
export type PickableModel = {
  endpointId: string
  displayName: string
  /** One line on what the model is for. Shown under the name in the picker. */
  description: string
  group: string
  thumbnailUrl: string | null
  priceLabel: string
  pricing: ModelDefinition['pricing']
  inputs: ModelInput[]
  acceptsReferences: boolean
  /** True when the endpoint refuses to run without one. */
  requiresReference: boolean
  featured: boolean
}

export function toPickable(model: ModelDefinition): PickableModel {
  return {
    endpointId: model.endpointId,
    displayName: model.displayName,
    description: model.description,
    group: model.group,
    thumbnailUrl: model.thumbnailUrl ?? null,
    priceLabel: `$${model.pricing.unitPriceUsd} / ${model.pricing.unit}`,
    pricing: model.pricing,
    // The prompt has the dock's textarea; rendering it again as a setting gives
    // the model two places to read the same thing from and the person one too
    // many to fill in.
    inputs: model.inputs.filter((input) => !input.hidden && input.name !== model.promptField),
    acceptsReferences: model.references.length > 0,
    requiresReference: model.references.some((mapping) => mapping.required),
    featured: model.featured,
  }
}
