import type { CatalogEntry } from './catalog.ts'
import { PRICING_RULES } from './contract-pricing.ts'
import { familyViolations, orderViolations } from './contract-set.ts'
import { allSlots } from './slots.ts'

export type Violation = { endpointId: string; rule: string; detail: string }

export type Rule = { rule: string; check: (entry: CatalogEntry) => string | null }

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
const RULES: Rule[] = [
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
      const takes =
        definition.references.some((mapping) => mapping.required) ||
        definition.inputs.some((input) => input.required && !input.hidden)
      return takes ? null : 'has nothing required at all, so nothing decides its output'
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
      /*
       * The dock starts with no settings and sends what was changed, so a
       * required control nobody touched is simply absent.
       *
       * A control somebody can see is exempt, because the dock asks for it: it
       * holds Generate back and names what is still empty, the way it does for
       * a missing reference. Several of these have no default that would work
       * anyway. A required list fails fal's own minimum when empty, and
       * MiniMax Music wants lyrics, for which the empty string is not a
       * sensible stand-in.
       *
       * A hidden one is the real fault. Nobody can fill it, so the payload can
       * never validate and the generation is refused before it leaves us.
       */
      const stuck = definition.inputs.find(
        (input) => input.required && input.default === undefined && input.hidden,
      )
      return stuck
        ? `${stuck.name} is required with no default and hidden, so nothing can ever fill it`
        : null
    },
  },
  {
    rule: 'rows-are-described',
    check: ({ definition }) => {
      for (const input of definition.inputs) {
        const rows = input.type === 'object-array'
        // Both directions. A list with no columns renders as nothing and sends
        // whatever it is given; columns on a control that is not a list are a
        // catalog author expecting a shape the dock will never draw.
        if (rows && (input.fields?.length ?? 0) === 0) {
          return `${input.name} is a list of rows and names no columns`
        }
        if (!rows && input.fields !== undefined) {
          return `${input.name} names columns but is a ${input.type}, not a list of rows`
        }
      }
      return null
    },
  },
  {
    rule: 'enum-options-exist',
    check: ({ definition }) => {
      const every = [...definition.inputs, ...definition.inputs.flatMap((i) => i.fields ?? [])]
      const empty = every.find((input) => input.type === 'enum' && (input.enum?.length ?? 0) === 0)
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
  ...PRICING_RULES,
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
