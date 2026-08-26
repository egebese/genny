import type { FalPublicKey } from './webhook.ts'

const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json'
const TTL_MS = 24 * 60 * 60 * 1000

let cache: { keys: FalPublicKey[]; fetchedAt: number } | null = null

/**
 * fal's webhook signing keys, cached for a day.
 *
 * A fetch failure falls back to whatever is cached, however old. The alternative
 * is rejecting every webhook while fal's key endpoint has a bad minute, and a
 * key that verified yesterday is a far better guess than no key at all.
 */
export async function falPublicKeys(
  options: { now?: number; url?: string } = {},
): Promise<FalPublicKey[]> {
  const now = options.now ?? Date.now()
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.keys

  try {
    const response = await fetch(options.url ?? JWKS_URL, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`jwks responded ${response.status}`)

    const body = (await response.json()) as { keys?: { x?: unknown }[] }
    const keys = (body.keys ?? [])
      .map((key) => key.x)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .map((x) => ({ x }))
    if (keys.length === 0) throw new Error('jwks carried no usable keys')

    cache = { keys, fetchedAt: now }
    return keys
  } catch (error) {
    if (cache) return cache.keys
    throw error
  }
}

/** Tests and long-lived processes that need to forget what they learned. */
export function clearJwksCache(): void {
  cache = null
}
