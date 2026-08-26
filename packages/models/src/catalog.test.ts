import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'

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

  it('gives every entry a prompt input, since the studio always sends one', async () => {
    for (const { definition } of await loadCatalog()) {
      const prompt = definition.inputs.find((i) => i.name === 'prompt')
      expect(prompt, `${definition.endpointId} has no prompt input`).toBeDefined()
      expect(prompt?.required).toBe(true)
    }
  })

  it('has no duplicate endpoint ids', async () => {
    const ids = (await loadCatalog()).map((e) => e.definition.endpointId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('orders entries by sortOrder so the picker is deterministic', async () => {
    const orders = (await loadCatalog()).map((e) => e.definition.sortOrder)
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b))
  })
})
