import type { Rule } from './contract.ts'
import { DURATION_FIELDS } from './duration.ts'

/**
 * The contract rules about money, next to the pricing schema they check.
 *
 * Split out when `contract.ts` hit the line cap, and the seam was already
 * there: everything else is about whether a control can be drawn, and these two
 * are about whether a request can be quoted before it is paid for.
 */
export const PRICING_RULES: Rule[] = [
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
]
