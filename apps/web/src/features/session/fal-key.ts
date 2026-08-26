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
