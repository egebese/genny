import { describe, expect, it } from 'vitest'
import type { PickableFamily } from './family-list.ts'
import type { PickableModel } from './model-list.ts'
import { whyBlocked } from './ui/dock-block.ts'

const family = { id: 'flux', name: 'FLUX', accepts: [] } as unknown as PickableFamily

const model = {
  endpointId: 'fal-ai/flux/schnell',
  requiresReference: false,
  inputs: [],
  pricing: { unit: 'images', unitPriceUsd: 0.01 },
  creditMultiplier: 1,
  promptField: 'prompt',
} as unknown as PickableModel

/** perUsd 1000 with a $0.01 model and no multiplier: one run costs 10 credits. */
function ask(overrides: Partial<Parameters<typeof whyBlocked>[0]> = {}) {
  return whyBlocked({
    family,
    model,
    mentionCount: 0,
    attachments: 0,
    mentions: 0,
    settings: {},
    credits: null,
    prompt: 'a cat',
    ...overrides,
  })
}

function withBalance(balance: number) {
  return { enabled: true, perUsd: 1000, balance }
}

describe('whyBlocked', () => {
  it('lets a runnable request through', () => {
    expect(ask()).toBeNull()
  })

  it('says nothing about credits in byok, where there are none', () => {
    expect(ask({ credits: null })).toBeNull()
  })

  it('lets a run through when the balance covers it', () => {
    expect(ask({ credits: withBalance(100) })).toBeNull()
  })

  /*
   * The balance was fetched, threaded all the way to the dock and then dropped,
   * so an empty account was discovered by pressing Generate and reading a
   * generic error from the hold that refused.
   */
  it('refuses before spending when the balance will not cover it', () => {
    expect(ask({ credits: withBalance(4) })).toEqual({ kind: 'needs-credits', short: 6 })
  })

  it('rounds a shortfall up, so the number offered is actually enough', () => {
    expect(ask({ credits: withBalance(9.5) })).toEqual({ kind: 'needs-credits', short: 1 })
  })

  it('refuses an empty balance rather than letting the hold discover it', () => {
    expect(ask({ credits: withBalance(0) })).toEqual({ kind: 'needs-credits', short: 10 })
  })

  /*
   * Order matters. Being told to buy credits before being told the prompt has
   * no image is advice about the wrong problem.
   */
  it('asks for the missing image before it asks for money', () => {
    const blocked = ask({
      model: { ...model, requiresReference: true },
      credits: withBalance(0),
    })
    expect(blocked).toEqual({ kind: 'needs-reference' })
  })
})
