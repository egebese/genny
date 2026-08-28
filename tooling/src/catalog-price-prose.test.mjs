import assert from 'node:assert/strict'
import { test } from 'node:test'
import { figuresIn, matchesPrice } from './catalog-price-prose.mjs'

const kling =
  'For every second of video you generated, you will be charged **$0.112** (audio off) or ' +
  '**$0.168** (audio on), if voice control is used you will be charged **$0.196**.'

test('reads every figure fal names, not just the first', () => {
  assert.deepEqual(figuresIn(kling), [0.112, 0.168, 0.196])
})

test('accepts a price the page names', () => {
  assert.equal(matchesPrice(figuresIn(kling), 0.168), true)
})

test('catches the mistake it exists for', () => {
  // H3 Max shipped at $0.00021 against a published $0.04 for as long as the
  // waiver silenced the only check that looked.
  assert.equal(matchesPrice([0.025, 0.04], 0.00021), false)
})

test('catches an error far smaller than that one', () => {
  assert.equal(matchesPrice([0.04], 0.038), false)
})

test('reads the same price written in another unit', () => {
  // $0.1 per 1000 characters is $0.0001 each, and the catalog stores the each.
  assert.equal(matchesPrice([0.1], 0.0001), true)
  // $0.1 per 30 seconds, rounded to a per-second rate, multiplies back to 0.0999.
  assert.equal(matchesPrice([0.1], 0.00333), true)
})

test('reads a figure written with the sign after it, as gemini-tts does', () => {
  assert.deepEqual(figuresIn('will cost **0.5$** per 1 M input tokens'), [0.5])
})

test('reads a figure with thousands separators', () => {
  assert.deepEqual(figuresIn('$1,250.00 per run'), [1250])
})
