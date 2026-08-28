import { loadCatalog } from '@genny/models/catalog.ts'
import { resolveTask } from '@genny/models/family.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import { allSlots, slotsAccepting } from '@genny/models/slots.ts'

export type VariantTarget = { model: ModelDefinition; slot: string }

/**
 * Which endpoint runs a variant, given the one that made the original.
 *
 * The same model, routed by what it is being handed. A family splits across
 * endpoints by input, so the family that wrote this image from text has, if it
 * has one at all, a sibling that edits an image, and handing it one picture is
 * how that sibling gets chosen. This is the same resolution the dock does when
 * you attach something; it is not a second idea about which model to use.
 *
 * Null when the family has no endpoint that takes an image. Text to speech has
 * none, and neither does a plain text-to-image model with no editing sibling.
 */
export async function editEndpointFor(endpointId: string | null): Promise<VariantTarget | null> {
  if (!endpointId) return null
  const catalog = await loadCatalog()
  const source = catalog.find((entry) => entry.definition.endpointId === endpointId)
  if (!source) return null

  const family = catalog
    .filter((entry) => entry.definition.family.id === source.definition.family.id)
    .map((entry) => ({
      endpointId: entry.definition.endpointId,
      modality: entry.definition.modality,
      slots: allSlots(entry.definition),
      required: allSlots(entry.definition).filter((slot) => slot.required),
      definition: entry.definition,
    }))

  const chosen = resolveTask(family, ['image'])
  if (!chosen) return null

  const slot = slotsAccepting(chosen.slots, 'image')[0]
  return slot ? { model: chosen.definition, slot: slot.field } : null
}

/**
 * The original settings, minus the ones the target endpoint has never heard of.
 *
 * "Same settings" is the point of a variant, but the endpoint running it is
 * usually not the endpoint that made the original: an editing sibling has its
 * own inputs, and `buildInputSchema` is strict, so forwarding an unknown field
 * refuses the whole generation. Carrying what fits and dropping the rest is the
 * only reading of "same settings" that runs.
 *
 * The prompt is dropped too. It is the one thing a variant is deliberately not
 * keeping.
 */
export function settingsCarriedTo(
  model: ModelDefinition,
  original: Record<string, unknown>,
): Record<string, unknown> {
  const known = new Set(
    model.inputs.filter((input) => input.name !== model.promptField).map((input) => input.name),
  )
  const slots = new Set(allSlots(model).map((slot) => slot.field))

  return Object.fromEntries(
    Object.entries(original).filter(([name]) => known.has(name) && !slots.has(name)),
  )
}
