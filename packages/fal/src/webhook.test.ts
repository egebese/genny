import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { type FalPublicKey, verifyFalWebhook } from './webhook.ts'

const REQUEST_ID = '11111111-2222-3333-4444-555555555555'
const USER_ID = 'user-1'
const NOW = new Date('2026-08-26T12:00:00Z')

function keypair(): { private: KeyObject; jwk: FalPublicKey } {
  const pair = generateKeyPairSync('ed25519')
  const jwk = pair.publicKey.export({ format: 'jwk' }) as { x: string }
  return { private: pair.privateKey, jwk }
}

const fal = keypair()

/** Signs exactly the way fal documents: four lines, the last a hash of the body. */
function deliver(
  body: string,
  options: {
    key?: KeyObject
    timestamp?: number
    signature?: string
    omit?: string
  } = {},
) {
  const timestamp = String(options.timestamp ?? Math.floor(NOW.getTime() / 1000))
  const digest = createHash('sha256').update(body, 'utf8').digest('hex')
  const message = Buffer.from([REQUEST_ID, USER_ID, timestamp, digest].join('\n'), 'utf8')
  const signature =
    options.signature ?? sign(null, message, options.key ?? fal.private).toString('hex')

  const headers = new Headers({
    'x-fal-webhook-request-id': REQUEST_ID,
    'x-fal-webhook-user-id': USER_ID,
    'x-fal-webhook-timestamp': timestamp,
    'x-fal-webhook-signature': signature,
  })
  if (options.omit) headers.delete(options.omit)
  return { headers, rawBody: body, keys: [fal.jwk], now: NOW }
}

const OK_BODY = JSON.stringify({
  request_id: REQUEST_ID,
  gateway_request_id: REQUEST_ID,
  status: 'OK',
  payload: { images: [{ url: 'https://fal.media/x.png' }] },
})

describe('verifyFalWebhook', () => {
  it('accepts a delivery fal actually signed', () => {
    const outcome = verifyFalWebhook(deliver(OK_BODY))
    expect(outcome).toEqual({ ok: true, event: { requestId: REQUEST_ID, status: 'OK' } })
  })

  it('carries the error through when the generation failed', () => {
    const body = JSON.stringify({ request_id: REQUEST_ID, status: 'ERROR', error: 'out of memory' })
    const outcome = verifyFalWebhook(deliver(body))
    expect(outcome).toEqual({
      ok: true,
      event: { requestId: REQUEST_ID, status: 'ERROR', error: 'out of memory' },
    })
  })

  it('refuses a body changed after signing', () => {
    const delivery = deliver(OK_BODY)
    delivery.rawBody = OK_BODY.replace('OK', 'ERROR')
    expect(verifyFalWebhook(delivery).ok).toBe(false)
  })

  it('refuses a signature from someone else entirely', () => {
    expect(verifyFalWebhook(deliver(OK_BODY, { key: keypair().private })).ok).toBe(false)
  })

  it('refuses a key we do not know, even though the signature is good', () => {
    const impostor = keypair()
    const delivery = deliver(OK_BODY, { key: impostor.private })
    expect(verifyFalWebhook({ ...delivery, keys: [fal.jwk] }).ok).toBe(false)
    // ...and accepts it once that key is one fal published, which is what makes
    // the rejection above a statement about the key rather than about the maths.
    expect(verifyFalWebhook({ ...delivery, keys: [fal.jwk, impostor.jwk] }).ok).toBe(true)
  })

  it('refuses a delivery replayed an hour later', () => {
    const old = Math.floor(NOW.getTime() / 1000) - 3600
    expect(verifyFalWebhook(deliver(OK_BODY, { timestamp: old })).ok).toBe(false)
  })

  it('refuses a timestamp from the future', () => {
    const ahead = Math.floor(NOW.getTime() / 1000) + 3600
    expect(verifyFalWebhook(deliver(OK_BODY, { timestamp: ahead })).ok).toBe(false)
  })

  it('allows the clock to be a little wrong', () => {
    const skewed = Math.floor(NOW.getTime() / 1000) - 120
    expect(verifyFalWebhook(deliver(OK_BODY, { timestamp: skewed })).ok).toBe(true)
  })

  it.each(['x-fal-webhook-request-id', 'x-fal-webhook-signature', 'x-fal-webhook-timestamp'])(
    'refuses a delivery missing %s',
    (header) => {
      expect(verifyFalWebhook(deliver(OK_BODY, { omit: header })).ok).toBe(false)
    },
  )

  it.each(['', 'not-hex', 'ab'])('refuses the malformed signature %j without throwing', (bad) => {
    expect(verifyFalWebhook(deliver(OK_BODY, { signature: bad })).ok).toBe(false)
  })

  it('refuses a body that is not a fal webhook at all', () => {
    expect(verifyFalWebhook(deliver('{"status":"MAYBE"}')).ok).toBe(false)
    expect(verifyFalWebhook(deliver('not json')).ok).toBe(false)
  })

  it('says the same thing however it failed, so it cannot be used to hunt for a signature', () => {
    const reasons = new Set(
      [
        deliver(OK_BODY, { key: keypair().private }),
        deliver(OK_BODY, { signature: 'ab' }),
        deliver(OK_BODY, { timestamp: 0 }),
        deliver(OK_BODY, { omit: 'x-fal-webhook-user-id' }),
      ].map((delivery) => {
        const outcome = verifyFalWebhook(delivery)
        return outcome.ok ? 'accepted' : outcome.reason
      }),
    )
    expect(reasons).toEqual(new Set(['invalid signature']))
  })
})
