import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

export type SealedKey = string

/**
 * A BYOK fal key is somebody else's money, so it is never persisted. It lives
 * only inside an encrypted cookie, and this is the only code that can read it.
 *
 * The expiry is inside the sealed payload rather than beside it, so a client
 * cannot extend its own session by editing a cookie attribute: tampering breaks
 * the GCM auth tag and the whole thing is rejected.
 */
export function sealKey(falKey: string, encryptionKey: string, ttlSeconds: number): SealedKey {
  if (!falKey.trim()) throw new Error('refusing to seal an empty fal key')
  const key = decodeEncryptionKey(encryptionKey)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const expiresAt = Date.now() + ttlSeconds * 1000
  const payload = JSON.stringify({ k: falKey, exp: expiresAt })
  const sealed = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), sealed].map((b) => b.toString('base64url')).join('.')
}

export type UnsealResult =
  | { ok: true; falKey: string; expiresAt: number }
  | { ok: false; reason: 'malformed' | 'tampered' | 'expired' }

/**
 * Never throws, and never reports why beyond a coarse reason. A decrypt oracle
 * that distinguishes "wrong key" from "bad padding" is a decrypt oracle.
 */
export function unsealKey(sealed: string, encryptionKey: string, now = Date.now()): UnsealResult {
  const parts = sealed.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [ivPart, tagPart, dataPart] = parts as [string, string, string]

  try {
    const iv = Buffer.from(ivPart, 'base64url')
    const tag = Buffer.from(tagPart, 'base64url')
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
      return { ok: false, reason: 'malformed' }

    const decipher = createDecipheriv(ALGORITHM, decodeEncryptionKey(encryptionKey), iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8')

    const parsed: unknown = JSON.parse(plain)
    if (!isSealedPayload(parsed)) return { ok: false, reason: 'malformed' }
    if (parsed.exp <= now) return { ok: false, reason: 'expired' }
    return { ok: true, falKey: parsed.k, expiresAt: parsed.exp }
  } catch {
    return { ok: false, reason: 'tampered' }
  }
}

function isSealedPayload(value: unknown): value is { k: string; exp: number } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { k?: unknown; exp?: unknown }
  return typeof candidate.k === 'string' && typeof candidate.exp === 'number'
}

function decodeEncryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64')
  if (key.length < 32) throw new Error('encryption key must decode to at least 32 bytes')
  return key.subarray(0, 32)
}

/** Constant-time comparison for anything key-shaped that has to be matched. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
