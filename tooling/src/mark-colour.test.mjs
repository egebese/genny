import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lift, liftMark, luminance, parseHex } from './mark-colour.mjs'

test('parses the three hex forms lobehub ships', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255])
  assert.deepEqual(parseHex('#3186ff'), [49, 134, 255])
  assert.deepEqual(parseHex('#3186ffcc'), [49, 134, 255])
  assert.equal(parseHex('#zzz'), null)
})

test('leaves a colour that is already visible exactly as it was', () => {
  for (const hex of ['#3186FF', '#FF6003', '#E80000', '#ffffff']) {
    assert.equal(lift(hex), hex)
  }
})

test('lifts a dark colour until it clears the floor', () => {
  const lifted = lift('#000000')
  assert.notEqual(lifted, '#000000')
  assert.ok(luminance(parseHex(lifted)) >= 0.09)
})

test('keeps the hue while lifting, so a dark red stays red', () => {
  const [r, g, b] = parseHex(lift('#1a0000'))
  assert.ok(r > g && r > b, `expected red to dominate, got ${r} ${g} ${b}`)
})

test('rewrites every hex in a mark and touches nothing else', () => {
  const svg = '<path fill="#0a0a0a"/><stop stop-color="#3186FF"/><rect fill="none"/>'
  const out = liftMark(svg)
  assert.ok(!out.includes('#0a0a0a'))
  assert.ok(out.includes('#3186FF'))
  assert.ok(out.includes('fill="none"'))
})
