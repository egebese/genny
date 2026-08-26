import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const ANONYMOUS_COOKIE = 'genny_actor'

/**
 * The BYOK demo has no sign-up, but every asset and job still needs an owner so
 * RLS has something to isolate on. An anonymous actor is a plain uuid the client
 * carries in a signed cookie.
 *
 * Signed, not encrypted: the id is not a secret, it just must not be forgeable.
 * Without the signature a visitor could type someone else's uuid and read their
 * gallery, since RLS would happily consider them that actor.
 */
export function issueAnonymousActor(secret: string): { actorId: string; cookieValue: string } {
  const actorId = randomUUID()
  return { actorId, cookieValue: `${actorId}.${sign(actorId, secret)}` }
}

export function verifyAnonymousActor(
  cookieValue: string | undefined,
  secret: string,
): string | null {
  if (!cookieValue) return null
  const separator = cookieValue.lastIndexOf('.')
  if (separator <= 0) return null

  const actorId = cookieValue.slice(0, separator)
  const signature = cookieValue.slice(separator + 1)
  if (!UUID_PATTERN.test(actorId)) return null
  return signaturesMatch(sign(actorId, secret), signature) ? actorId : null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sign(actorId: string, secret: string): string {
  if (!secret) throw new Error('cannot sign an actor id without a secret')
  return createHmac('sha256', secret).update(actorId).digest('base64url')
}

function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}
