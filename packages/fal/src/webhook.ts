import { createHash, createPublicKey, verify } from 'node:crypto'

/** fal's own leeway recommendation, and the width of the replay window. */
export const TIMESTAMP_TOLERANCE_SECONDS = 300

export type FalWebhookEvent = {
  requestId: string
  status: 'OK' | 'ERROR'
  error?: string
}

export type VerifyOutcome = { ok: true; event: FalWebhookEvent } | { ok: false; reason: string }

/** An ED25519 public key as it appears in fal's JWKS: base64url in `x`. */
export type FalPublicKey = { x: string }

/**
 * Checks that fal sent this, and sent it recently.
 *
 * Keys are a parameter rather than a fetch, so the rule this encodes can be
 * tested against a keypair made on the spot instead of against the internet.
 *
 * Every rejection answers the same way. A verifier that distinguishes "bad
 * signature" from "unknown key" is a tool for finding a good signature.
 */
export function verifyFalWebhook(input: {
  headers: Headers
  rawBody: string
  keys: FalPublicKey[]
  now?: Date
}): VerifyOutcome {
  const requestId = input.headers.get('x-fal-webhook-request-id')
  const userId = input.headers.get('x-fal-webhook-user-id')
  const timestamp = input.headers.get('x-fal-webhook-timestamp')
  const signature = input.headers.get('x-fal-webhook-signature')
  if (!requestId || !userId || !timestamp || !signature) return refuse()

  const sentAt = Number(timestamp)
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000)
  // Both directions: a future timestamp is as much a forgery signal as an old
  // one, and a replayed delivery is only useful inside this window.
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > TIMESTAMP_TOLERANCE_SECONDS) {
    return refuse()
  }

  const digest = createHash('sha256').update(input.rawBody, 'utf8').digest('hex')
  const message = Buffer.from([requestId, userId, timestamp, digest].join('\n'), 'utf8')

  let offered: Buffer
  try {
    offered = Buffer.from(signature, 'hex')
    if (offered.length !== 64) return refuse()
  } catch {
    return refuse()
  }

  // fal rotates keys, so the JWKS carries several and any one of them may be the
  // signer. A malformed key is skipped, not fatal: the next one may be good.
  const signed = input.keys.some((key) => {
    try {
      const publicKey = createPublicKey({
        key: { kty: 'OKP', crv: 'Ed25519', x: key.x },
        format: 'jwk',
      })
      return verify(null, message, publicKey, offered)
    } catch {
      return false
    }
  })
  if (!signed) return refuse()

  const parsed = parseBody(input.rawBody)
  if (!parsed) return refuse()
  // The signature covers the body, so the header is the authority on which
  // request this is: a body claiming a different id has still been signed for
  // this one, and the header is what fal put in the message.
  return { ok: true, event: { ...parsed, requestId } }
}

function parseBody(rawBody: string): Omit<FalWebhookEvent, 'requestId'> | null {
  try {
    const body = JSON.parse(rawBody) as { status?: unknown; error?: unknown }
    if (body.status !== 'OK' && body.status !== 'ERROR') return null
    return typeof body.error === 'string'
      ? { status: body.status, error: body.error }
      : { status: body.status }
  } catch {
    return null
  }
}

function refuse(): VerifyOutcome {
  return { ok: false, reason: 'invalid signature' }
}
