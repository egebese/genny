import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyWebhook } from './stripe-client.ts'

const SECRET_KEY = 'sk_test_not_a_real_key'
const WEBHOOK_SECRET = 'whsec_test_secret'

/**
 * Stripe signs `${timestamp}.${body}` with HMAC-SHA256 and sends it as
 * `t=<ts>,v1=<hex>`. Building it here rather than mocking the verifier means the
 * test exercises the real check.
 */
function sign(body: string, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: { id: 'in_1' } } })

describe('verifyWebhook', () => {
  it('accepts a correctly signed body', () => {
    const result = verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, body, sign(body))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.event.id).toBe('evt_1')
  })

  it('refuses a body that changed after signing', () => {
    const signature = sign(body)
    const tampered = body.replace('in_1', 'in_2')
    expect(verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, tampered, signature).ok).toBe(false)
  })

  it('refuses a signature made with a different secret', () => {
    expect(verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, body, sign(body, 'whsec_wrong')).ok).toBe(
      false,
    )
  })

  it('refuses an old timestamp, so a captured request cannot be replayed later', () => {
    const hourAgo = Math.floor(Date.now() / 1000) - 3600
    expect(
      verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, body, sign(body, WEBHOOK_SECRET, hourAgo)).ok,
    ).toBe(false)
  })

  it('refuses a missing or malformed signature without throwing', () => {
    for (const signature of [null, '', 'nonsense', 't=1', 'v1=abc']) {
      expect(verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, body, signature).ok).toBe(false)
    }
  })

  it('says nothing useful about why it failed', () => {
    const result = verifyWebhook(SECRET_KEY, WEBHOOK_SECRET, body, 't=1,v1=deadbeef')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid signature')
  })
})
