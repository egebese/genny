import type { CatalogEntry } from './catalog.ts'
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
        const wrong = ratesAgainstOptions(definition, rate)
        if (wrong) return wrong
      }
      for (const fee of definition.pricing.surcharges ?? []) {
        const field = definition.inputs.find((input) => input.name === fee.field)
        if (!field) return `pricing surcharges on ${fee.field}, which is not an input`
      }
      return null
    },
  },
]

/** Every value a rate keys on has to be a value the control can hold. */
function ratesAgainstOptions(
  definition: CatalogEntry['definition'],
  rate: { field: string; and?: string | undefined; factors: Record<string, number> },
): string | null {
  const names = rate.and ? [rate.field, rate.and] : [rate.field]
  const options: string[][] = []
  for (const name of names) {
    const field = definition.inputs.find((input) => input.name === name)
    if (!field) return `pricing scales on ${name}, which is not an input`
    // A switch has two options and no enum listing them. Kling charges a third
    // less with audio off, which is a rate on a boolean.
    options.push(field.type === 'boolean' ? ['true', 'false'] : (field.enum ?? []).map(String))
  }
  for (const key of Object.keys(rate.factors)) {
    const parts = key.split('|')
    if (parts.length !== names.length) {
      return `pricing scales on ${names.join(' and ')} but keys on "${key}"`
    }
    const wrong = parts.findIndex((part, at) => !options[at]?.includes(part))
    if (wrong !== -1) return `pricing scales on ${names[wrong]}="${parts[wrong]}", not an option`
  }
  return null
}
