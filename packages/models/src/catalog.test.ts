import { describe, expect, it } from 'vitest'
import { loadCatalog } from './catalog.ts'
import { estimateUnits } from './credits.ts'
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

  it('has decided, per entry, what a 4K option costs', async () => {
    /*
     * fal charges 4K at double on the models that offer it, and our estimate
     * becomes the hold: `settle` captures held × produced ÷ expected and never
     * more, so a missing factor is not a rounding error, it is half price
     * forever on that setting.
     *
     * This asks for a decision rather than for a factor. A future endpoint may
     * genuinely charge one rate at every size; what it may not do is offer 4K
     * with nobody having looked.
     */
    for (const { definition } of await loadCatalog()) {
      const offers4K = definition.inputs.some(
        (input) => input.name === 'resolution' && input.enum?.includes('4K'),
      )
      if (!offers4K) continue

      const decided =
        (definition.pricing.scale ?? []).some((rate) => rate.factors['4K'] !== undefined) ||
        (definition.pricing.note?.includes('4K') ?? false)
      expect(decided, `${definition.endpointId} offers 4K and says nothing about its price`).toBe(
        true,
      )
    }
  })

  it('charges enough per second for the models fal bills per compute second', async () => {
    /*
     * H3 Max is billed on GPU time, a quantity that does not exist until the job
     * has run, so its catalog price is a resale per second of output measured
     * against real runs. Recorded here because the measurement is the only thing
     * holding the number up: fal's own answer is in a unit we cannot estimate,
     * so `catalog:check` reports drift and is waived by the note.
     *
     * Worst observed rate, not average. A cheaper number is a permanent loss:
     * the estimate is the hold and `settle` never captures more than it held.
     */
    const measured = [
      { duration: 5, resolution: '768P', costUsd: 0.00094 },
      { duration: 5, resolution: '768P', costUsd: 0.001 },
      { duration: 10, resolution: '768P', costUsd: 0.00178 },
      { duration: 15, resolution: '768P', costUsd: 0.00313 },
      { duration: 5, resolution: '480P', costUsd: 0.00062 },
      { duration: 15, resolution: '480P', costUsd: 0.00096 },
    ]

    const entries = (await loadCatalog()).filter((e) => e.definition.family.id === 'h3-max')
    expect(entries.length).toBeGreaterThan(0)

    for (const { definition } of entries) {
      for (const run of measured) {
        const units = estimateUnits(definition, run)
        const charged = definition.pricing.unitPriceUsd * units
        expect(
          charged,
          `${definition.endpointId} charges $${charged} for a ${run.duration}s ${run.resolution} clip that cost fal $${run.costUsd}`,
        ).toBeGreaterThanOrEqual(run.costUsd)
      }
    }
  })

  it('orders entries by sortOrder so the picker is deterministic', async () => {
    const orders = (await loadCatalog()).map((e) => e.definition.sortOrder)
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b))
  })
})
