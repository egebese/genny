import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'
import { contractRules, contractViolations } from './contract.ts'

describe('the catalog contract', () => {
  it('holds for every shipped entry', async () => {
    const violations = contractViolations(await loadCatalog())
    const readable = violations.map((v) => `${v.endpointId} [${v.rule}] ${v.detail}`)
    expect(readable).toEqual([])
  })

  it('has a rule for each way a model has reached the product broken', () => {
    // Not a count for its own sake. If a rule is deleted, the case it was
    // written for has to be argued away in the same change.
    expect(contractRules).toEqual([
      'prompt-field-exists',
      'has-something-to-work-from',
      'count-is-bounded',
      'required-inputs-can-arrive',
      'enum-options-exist',
      'default-is-an-option',
      'slots-are-describable',
      'priced-in-a-unit-we-can-estimate',
      'conditional-rates-are-decided',
      'family-agrees-on-its-name',
      'sort-order-is-unique',
      'has-a-provider-mark',
    ])
  })

  it('catches an entry that breaks one', async () => {
    const [first] = await loadCatalog()
    if (!first) throw new Error('the catalog is empty')

    const broken = {
      ...first,
      definition: { ...first.definition, promptField: 'not_an_input' },
    }
    const violations = contractViolations([broken])
    expect(violations.map((v) => v.rule)).toContain('prompt-field-exists')
  })

  it('catches a price that scales on something the model does not offer', async () => {
    const [first] = await loadCatalog()
    if (!first) throw new Error('the catalog is empty')

    const broken = {
      ...first,
      definition: {
        ...first.definition,
        pricing: {
          ...first.definition.pricing,
          scale: [{ field: 'resolution', factors: { '8K': 4 } }],
        },
      },
    }
    expect(contractViolations([broken]).map((v) => v.rule)).toContain(
      'conditional-rates-are-decided',
    )
  })

  it('catches two endpoints of one model disagreeing about its name', async () => {
    const [first, second] = await loadCatalog()
    if (!first || !second) throw new Error('the catalog is too small to test this')

    const a = { ...first, definition: { ...first.definition, family: { id: 'x', name: 'One' } } }
    const b = { ...second, definition: { ...second.definition, family: { id: 'x', name: 'Two' } } }
    expect(contractViolations([a, b]).map((v) => v.rule)).toContain('family-agrees-on-its-name')
  })
})
