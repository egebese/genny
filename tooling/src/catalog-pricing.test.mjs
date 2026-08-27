import assert from 'node:assert/strict'
import { test } from 'node:test'
import { comparePrice, normalise } from './catalog-pricing.mjs'

const entry = (unit, unitPriceUsd) => ({ endpointId: 'fal-ai/x', pricing: { unit, unitPriceUsd } })

test('says nothing when the two agree', () => {
  assert.equal(
    comparePrice(entry('images', 0.08), { unit: 'images', unit_price: 0.08, unitPriceUsd: 0.08 }),
    null,
  )
})

test('treats a wording difference as agreement, not as drift', () => {
  // $0.10 per 1000 characters is $0.0001 per character. Reporting that as a
  // change would train everyone to ignore the report.
  assert.equal(
    comparePrice(entry('characters', 0.0001), { unit: '1000 characters', unitPriceUsd: 0.1 }),
    null,
  )
  assert.equal(comparePrice(entry('requests', 0.2), { unit: 'audios', unitPriceUsd: 0.2 }), null)
})

test('reports a real difference, and which way it goes', () => {
  const note = comparePrice(entry('images', 0.04), { unit: 'images', unitPriceUsd: 0.08 })
  assert.match(note, /moved UP/)
  assert.match(note, /undercharging/)
})

test('reports a different unit as a different quantity, not a different number', () => {
  const note = comparePrice(entry('images', 0.08), { unit: 'megapixels', unitPriceUsd: 0.08 })
  assert.match(note, /wrong quantity/)
})

test('never passes an endpoint it could not get a price for', () => {
  assert.match(comparePrice(entry('images', 0.08), undefined), /no price/)
})

test('converts before comparing, not after', () => {
  assert.deepEqual(normalise({ unit: '1000 characters', unitPriceUsd: 0.1 }), {
    unit: 'characters',
    unitPriceUsd: 0.0001,
  })
})
