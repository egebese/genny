import type { MediaKind } from './aspect.ts'
import type { ModelDefinition, ReferenceMapping, ReferenceRole } from './schema.ts'

/** Fallback copy, so a catalog entry only writes a label when the default is wrong. */
const ROLE_LABELS: Record<ReferenceRole, string> = {
  source: 'Use as input',
  'start-frame': 'Use as start frame',
  'end-frame': 'Use as end frame',
  reference: 'Use as reference',
  'input-images': 'Add to input images',
  'style-reference': 'Use as style reference',
  'driving-audio': 'Use as driving audio',
  'voice-sample': 'Use as voice sample',
  mask: 'Use as mask',
}

export type ReferenceSlot = {
  field: string
  role: ReferenceRole
  label: string
  accepts: readonly MediaKind[]
  array: boolean
  maxCount: number
  required: boolean
}

function toSlot(mapping: ReferenceMapping): ReferenceSlot {
  return {
    field: mapping.field,
    role: mapping.role,
    label: mapping.label ?? ROLE_LABELS[mapping.role],
    accepts: mapping.accepts,
    array: mapping.array,
    maxCount: mapping.maxCount,
    required: mapping.required,
  }
}

/**
 * Every slot this model offers.
 *
 * Crosses to the client whole, because a right-click menu is built from it: a
 * model added next month gets its menu items from its own catalog entry, and
 * nothing in the UI has to learn its name.
 */
export function allSlots(model: ModelDefinition): ReferenceSlot[] {
  return model.references.map(toSlot)
}

/** The slots that will take media of `kind`. */
export function slotsAccepting(slots: readonly ReferenceSlot[], kind: MediaKind): ReferenceSlot[] {
  return slots.filter((slot) => slot.accepts.includes(kind))
}

export function slotsFor(model: ModelDefinition, kind: MediaKind): ReferenceSlot[] {
  return slotsAccepting(allSlots(model), kind)
}

/** True when every one of `kinds` has somewhere to go on this model. */
export function acceptsAll(model: ModelDefinition, kinds: readonly MediaKind[]): boolean {
  return kinds.every((kind) => slotsFor(model, kind).length > 0)
}

/**
 * How many of `kind` this model can take at once, across every slot that fits.
 *
 * Used to tell someone their selection of six is two too many before they spend
 * the round trip finding out from a 422.
 */
export function capacityFor(model: ModelDefinition, kind: MediaKind): number {
  return slotsFor(model, kind).reduce((total, slot) => total + slot.maxCount, 0)
}

/**
 * Kinds this model has no slot for at all.
 *
 * The difference that matters is between "took four of your five" and "took
 * none of them". The first is a warning after the fact; the second means the
 * generation you paid for ignored the thing you gave it, and it has to be
 * refused before anything is held.
 */
export function unusableKinds(
  slots: readonly ReferenceSlot[],
  kinds: readonly MediaKind[],
): MediaKind[] {
  return [...new Set(kinds)].filter((kind) => slotsAccepting(slots, kind).length === 0)
}

/**
 * What both sides of the wire have in common.
 *
 * The server holds a `ModelDefinition` and the browser holds a `PickableModel`,
 * and this is the part of each that decides whether a reference has anywhere to
 * go. Writing the rule against the shared part is what keeps the dock's answer
 * and the server's refusal from ever disagreeing.
 */
export type Slotted = {
  endpointId: string
  modality: MediaKind
  slots: readonly ReferenceSlot[]
}

/**
 * A model that could take what this one cannot, nearest first.
 *
 * Nearest means the same endpoint with a suffix: `nano-banana-2` and
 * `nano-banana-2/edit` are the same model with and without an input, and
 * offering the sibling is a better answer than offering the alphabetical first
 * thing that happens to accept an image.
 */
export function suggestFor<T extends Slotted>(
  models: readonly T[],
  chosen: Slotted,
  kinds: readonly MediaKind[],
): T | null {
  const able = models.filter(
    (candidate) =>
      candidate.endpointId !== chosen.endpointId &&
      candidate.modality === chosen.modality &&
      unusableKinds(candidate.slots, kinds).length === 0,
  )
  const sibling = able.find((candidate) => candidate.endpointId.startsWith(`${chosen.endpointId}/`))
  return sibling ?? able[0] ?? null
}
