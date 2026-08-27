import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'
import { allSlots } from './slots.ts'

describe('loadCatalog', () => {
  it('loads and validates every shipped catalog entry', async () => {
    const entries = await loadCatalog()
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.definition.endpointId).toMatch(/^[\w.-]+\/[\w./-]+$/)
      expect(entry.definition.pricing.unitPriceUsd).toBeGreaterThan(0)
      expect(entry.hash).toHaveLength(16)
    }
  })

  it('gives every entry the prompt input it names, since the studio always sends one', async () => {
    for (const { definition } of await loadCatalog()) {
      const prompt = definition.inputs.find((i) => i.name === definition.promptField)
      expect(
        prompt,
        `${definition.endpointId} has no ${definition.promptField} input`,
      ).toBeDefined()
      expect(prompt?.required).toBe(true)
    }
  })

  it('has no duplicate endpoint ids', async () => {
    const ids = (await loadCatalog()).map((e) => e.definition.endpointId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares slots a menu can be built from', async () => {
    for (const { definition } of await loadCatalog()) {
      const slots = allSlots(definition)
      const fields = slots.map((slot) => slot.field)
      expect(new Set(fields).size, `${definition.endpointId} names a field twice`).toBe(
        fields.length,
      )

      for (const slot of slots) {
        const where = `${definition.endpointId} ${slot.field}`
        // A single-url field claiming room for two accepts a second reference
        // and sends only the last one, which nobody watching sees happen.
        if (!slot.array) expect(slot.maxCount, where).toBe(1)
        // Copy falls back to the role. A role with no entry in ROLE_LABELS
        // arrives here as undefined and reaches the menu the same way.
        expect(typeof slot.label, where).toBe('string')
        expect(slot.label.length, where).toBeGreaterThan(0)
      }
    }
  })

  it('orders entries by sortOrder so the picker is deterministic', async () => {
    const orders = (await loadCatalog()).map((e) => e.definition.sortOrder)
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b))
  })
})
