import type { CatalogEntry } from './catalog.ts'
import { familyViolations, orderViolations } from './contract-set.ts'
import { DURATION_FIELDS } from './duration.ts'
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
      // Null is a model with nothing to type at, which the next rule covers.
      if (definition.promptField === null) return null
      const field = definition.inputs.find((input) => input.name === definition.promptField)
      if (!field) return `promptField "${definition.promptField}" is not one of its inputs`
      return field.required ? null : `promptField "${field.name}" is not required`
    },
  },
  {
    rule: 'has-something-to-work-from',
    check: ({ definition }) => {
      /*
       * A model with no prompt has to be given something instead. An upscaler
       * takes a picture and makes it bigger, which is a whole generation
       * without a sentence in it; a model with neither a prompt nor a required
       * reference is one the dock can offer no way to use, and pressing
       * Generate on it would spend money on nothing anybody asked for.
       */
      if (definition.promptField !== null) return null
      const takes = definition.references.some((mapping) => mapping.required)
      return takes ? null : 'has no prompt and no required reference, so nothing decides its output'
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
    rule: 'required-inputs-can-arrive',
    check: ({ definition }) => {
      // The dock starts with no settings and sends what was changed, so a
      // required control nobody touched is simply absent. The prompt is exempt:
      // it is injected by name rather than carried in settings.
      const stuck = definition.inputs.find(
        (input) =>
          input.required &&
          input.default === undefined &&
          input.name !== definition.promptField &&
          !input.hidden,
      )
      return stuck
        ? `${stuck.name} is required with no default, so a generation nobody adjusted cannot validate`
        : null
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
          // Compared as text: the options may be numbers and the default is
          // `unknown`, and `5` and `"5"` are the same choice to a person.
          !input.enum?.some((option) => String(option) === String(input.default)),
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
      const { pricing } = definition
      if (pricing.unitPriceUsd <= 0) return 'unitPriceUsd is zero or negative'
      if (pricing.unit !== 'seconds' && pricing.unit !== 'minutes') return null
      // Either the length is a control, or the entry says what to assume. The
      // second case is real: some endpoints choose their own length, and one
      // that bills by the second and picks its own has to declare a ceiling.
      if (pricing.duration?.assume !== undefined) return null
      const named = pricing.duration?.field
      const found = definition.inputs.some((input) =>
        named ? input.name === named : DURATION_FIELDS.includes(input.name),
      )
      if (found) return null
      return named
        ? `pricing names ${named} as its duration, which is not an input`
        : `billed per ${pricing.unit.replace(/s$/, '')} with no duration input and no assumed length`
    },
  },
  {
    rule: 'conditional-rates-are-decided',
    check: ({ definition }) => {
      for (const rate of definition.pricing.scale ?? []) {
        const field = definition.inputs.find((input) => input.name === rate.field)
        if (!field) return `pricing scales on ${rate.field}, which is not an input`
        const unknown = Object.keys(rate.factors).find(
          (value) => !field.enum?.some((option) => String(option) === value),
        )
        if (unknown) return `pricing scales on ${rate.field}="${unknown}", not an option`
      }
      for (const fee of definition.pricing.surcharges ?? []) {
        const field = definition.inputs.find((input) => input.name === fee.field)
        if (!field) return `pricing surcharges on ${fee.field}, which is not an input`
      }
      return null
    },
  },
  {
    rule: 'family-agrees-on-its-name',
    check: () => null,
  },
  {
    rule: 'sort-order-is-unique',
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
  return [...found, ...familyViolations(entries), ...orderViolations(entries)]
}

export const contractRules = RULES.map(({ rule }) => rule)
