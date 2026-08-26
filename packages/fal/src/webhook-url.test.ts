import { describe, expect, it } from 'vitest'
import { falWebhookUrl } from './webhook-url.ts'

describe('falWebhookUrl', () => {
  it('points at the route on a public https deployment', () => {
    expect(falWebhookUrl({ mode: 'saas', appUrl: 'https://genny.example' })).toBe(
      'https://genny.example/api/webhooks/fal',
    )
  })

  it('keeps a path prefix, since not every deployment owns its root', () => {
    expect(falWebhookUrl({ mode: 'saas', appUrl: 'https://example.com/studio' })).toBe(
      'https://example.com/api/webhooks/fal',
    )
  })

  it.each([
    'http://localhost:3000',
    'https://localhost:3000',
    'https://127.0.0.1',
    'https://mac.local',
    'https://10.0.0.5',
    'https://192.168.1.9',
    'https://172.20.0.4',
    'http://genny.example',
    'not a url',
  ])('gives up on %s, which fal could not reach', (appUrl) => {
    expect(falWebhookUrl({ mode: 'saas', appUrl })).toBeUndefined()
  })

  it('never registers one in byok, where the callback has no key to settle with', () => {
    expect(falWebhookUrl({ mode: 'byok', appUrl: 'https://genny.example' })).toBeUndefined()
  })
})
