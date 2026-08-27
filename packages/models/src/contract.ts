import type { CatalogEntry } from './catalog.ts'
import { allSlots } from './slots.ts'

export type Violation = { endpointId: string; rule: string; detail: string }

/**
 * What every catalog entry has to be true of.
 *
 * These are not style rules. Each one is a way a model has already reached the
 * product broken: a price that did not match what fal charges, a control the
 * dock renders as a shape it is not, a reference slot no menu could describe.
 * A new entry passes all of them or it does not ship.
 *
 * Written as data rather than as assertions so the same list can run in a test,
 * in `catalog:sync`, and one day in an admin panel that adds a model without a
 * deploy.
 */
const RULES: {
  rule: string
  check: (entry: CatalogEntry) => string | null
}[] = [
  {
    rule: 'prompt-field-exists',
    check: ({ definition }) => {
      const field = definition.inputs.find((input) => input.name === definition.promptField)
      if (!field) return `promptField "${definition.promptField}" is not one of its inputs`
      return field.required ? null : `promptField "${field.name}" is not required`
    },
  },
  {
    rule: 'count-is-bounded',
    check: ({ definition }) => {
      const count = definition.inputs.find((input) => input.name === 'num_images')
      if (!count) return null
      // The dock renders this as a stepper and the stepper needs somewhere to
      // stop; past the endpoint's own ceiling fal answers 422 and says nothing.
      return count.min !== undefined && count.max !== undefined
        ? null
        : 'num_images has no min and max, so the stepper cannot bound it'
    },
  },
  {
    rule: 'enum-options-exist',
    check: ({ definition }) => {
      const empty = definition.inputs.find(
        (input) => input.type === 'enum' && (input.enum?.length ?? 0) === 0,
      )
      return empty ? `${empty.name} is an enum with no options` : null
    },
  },
  {
    rule: 'default-is-an-option',
    check: ({ definition }) => {
      const wrong = definition.inputs.find(
        (input) =>
          input.type === 'enum' &&
          input.default !== undefined &&
          !input.enum?.includes(String(input.default)),
      )
      return wrong ? `${wrong.name} defaults to a value it does not offer` : null
    },
  },
  {
    rule: 'slots-are-describable',
    check: ({ definition }) => {
      const slots = allSlots(definition)
      const fields = new Set<string>()
      for (const slot of slots) {
        if (fields.has(slot.field)) return `two slots share the field ${slot.field}`
        fields.add(slot.field)
        if (!slot.array && slot.maxCount !== 1) {
          return `${slot.field} takes one url but claims maxCount ${slot.maxCount}`
        }
        if (slot.accepts.length === 0) return `${slot.field} accepts nothing`
        if (!slot.label.trim()) return `${slot.field} has no label a menu could show`
      }
      return null
    },
  },
  {
    rule: 'priced-in-a-unit-we-can-estimate',
    check: ({ definition }) => {
      if (definition.pricing.unitPriceUsd <= 0) return 'unitPriceUsd is zero or negative'
      const needsDuration = definition.pricing.unit === 'seconds'
      const hasDuration = definition.inputs.some((input) => /duration|seconds/.test(input.name))
      return needsDuration && !hasDuration
        ? 'billed per second with no duration input, so the estimate guesses'
        : null
    },
  },
  {
    rule: 'conditional-rates-are-decided',
    check: ({ definition }) => {
      const scale = definition.pricing.scale
      if (!scale) return null
      const field = definition.inputs.find((input) => input.name === scale.field)
      if (!field) return `pricing scales on ${scale.field}, which is not an input`
      const unknown = Object.keys(scale.factors).find((value) => !field.enum?.includes(value))
      return unknown ? `pricing scales on ${scale.field}="${unknown}", not an option` : null
    },
  },
  {
    rule: 'family-agrees-on-its-name',
    check: () => null,
  },
  {
    rule: 'has-a-provider-mark',
    check: ({ definition }) =>
      definition.markUrl ? null : 'no provider mark, so the picker draws a hole',
  },
]

export function contractViolations(entries: readonly CatalogEntry[]): Violation[] {
  const found: Violation[] = []
  for (const entry of entries) {
    for (const { rule, check } of RULES) {
      const detail = check(entry)
      if (detail) found.push({ endpointId: entry.definition.endpointId, rule, detail })
    }
  }
  return [...found, ...familyViolations(entries)]
}

/**
 * A family is a set, so its rule is about the set rather than about one entry.
 *
 * The name is repeated on every member because deriving it would mean picking
 * whichever member happens to sort first; repeating it means they can disagree,
 * so they are checked.
 */
function familyViolations(entries: readonly CatalogEntry[]): Violation[] {
  const names = new Map<string, string>()
  const found: Violation[] = []

  for (const { definition } of entries) {
    const seen = names.get(definition.family.id)
    if (seen === undefined) {
      names.set(definition.family.id, definition.family.name)
    } else if (seen !== definition.family.name) {
      found.push({
        endpointId: definition.endpointId,
        rule: 'family-agrees-on-its-name',
        detail: `calls its family "${definition.family.name}" where another member calls it "${seen}"`,
      })
    }
  }
  return found
}

export const contractRules = RULES.map(({ rule }) => rule)
