import { describe, expect, it } from 'vitest'
import { autoDismisses, TOAST_MS } from './toast-policy.ts'

describe('autoDismisses', () => {
  it('lets a failure wait to be read', () => {
    expect(autoDismisses('danger')).toBe(false)
  })

  it('clears everything else on its own', () => {
    for (const tone of ['info', 'success', 'warning'] as const) {
      expect(autoDismisses(tone)).toBe(true)
    }
  })

  it('waits long enough to read a sentence', () => {
    // Under two seconds is a flash nobody catches; over ten is nagging.
    expect(TOAST_MS).toBeGreaterThanOrEqual(3000)
    expect(TOAST_MS).toBeLessThanOrEqual(8000)
  })
})
