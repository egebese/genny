import { env } from '@genny/env/env.ts'
import { type FalCredentials, resolveCredentials } from '@genny/fal/credentials.ts'
import { sealKey } from '@genny/fal/key-cipher.ts'
import { cookies } from 'next/headers'
import { secureCookies } from './cookie-flags.ts'

export const FAL_KEY_COOKIE = 'genny_fal'
const TTL_SECONDS = 60 * 60 * 12

/**
 * Stores the visitor's own fal key, sealed. The cookie is httpOnly so no script
 * on the page can read it back, and the expiry lives inside the sealed payload so
 * editing the cookie's own Max-Age extends nothing.
 */
export async function storeFalKey(falKey: string): Promise<void> {
  const jar = await cookies()
  jar.set(FAL_KEY_COOKIE, sealKey(falKey, env().GENNY_ENCRYPTION_KEY, TTL_SECONDS), {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export async function clearFalKey(): Promise<void> {
  const jar = await cookies()
  jar.delete(FAL_KEY_COOKIE)
}

/**
 * Resolves whose key pays for a generation. In saas mode the visitor's cookie is
 * ignored entirely, so nobody can shift the bill by pasting a key.
 */
export async function readCredentials(): Promise<FalCredentials> {
  const jar = await cookies()
  return resolveCredentials({
    mode: env().GENNY_MODE,
    serverKey: env().FAL_KEY,
    sealedUserKey: jar.get(FAL_KEY_COOKIE)?.value,
    encryptionKey: env().GENNY_ENCRYPTION_KEY,
  })
}

/** True when a generation can be attempted at all. Drives the key prompt. */
export async function hasUsableCredentials(): Promise<boolean> {
  try {
    await readCredentials()
    return true
  } catch {
    return false
  }
}

export type FalKeyStatus =
  | { mode: 'saas' }
  | { mode: 'byok'; present: false }
  | { mode: 'byok'; present: true; expiresAt: number; hint: string }

/**
 * What can honestly be said about the stored key without handing it over.
 *
 * The key itself never crosses to the browser and is never rendered, so this is
 * everything a settings page is allowed to know: that there is one, roughly
 * which one, and when the cookie stops working. Before this the only signal
 * anywhere was a boolean, which is why the key could be pasted once and then
 * neither seen nor replaced until the twelve hours ran out.
 *
 * The hint is the leading characters of the key id, never the secret half. A
 * fal key is `<id>:<secret>` and the id is the part printed in fal's own
 * dashboard, so it is what somebody compares against to answer "is this the
 * right one".
 */
export async function falKeyStatus(): Promise<FalKeyStatus> {
  if (env().GENNY_MODE === 'saas') return { mode: 'saas' }
  try {
    const credentials = await readCredentials()
    if (credentials.kind !== 'user') return { mode: 'byok', present: false }
    return {
      mode: 'byok',
      present: true,
      expiresAt: credentials.expiresAt,
      hint: `${credentials.key.split(':')[0]?.slice(0, 8) ?? ''}…`,
    }
  } catch {
    // Missing, expired or tampered with all mean the same thing here: there is
    // nothing usable, and a settings page saying which would be a hint to
    // somebody who did the tampering.
    return { mode: 'byok', present: false }
  }
}
