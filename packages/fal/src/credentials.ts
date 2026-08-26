import { unsealKey } from './key-cipher.ts'

export type FalCredentials =
  | { kind: 'server'; key: string }
  | { kind: 'user'; key: string; expiresAt: number }

export type CredentialsRequest = {
  mode: 'byok' | 'saas'
  /** Server key from the environment. Required in saas mode, ignored in byok. */
  serverKey?: string | undefined
  /** Sealed cookie value carrying the visitor's own key. byok mode only. */
  sealedUserKey?: string | undefined
  encryptionKey: string
}

export class MissingCredentialsError extends Error {
  constructor(
    readonly reason: 'no-user-key' | 'user-key-expired' | 'user-key-invalid' | 'no-server-key',
  ) {
    super(`fal credentials unavailable: ${reason}`)
    this.name = 'MissingCredentialsError'
  }
}

/**
 * The single place that decides whose key pays for a generation. Keeping the mode
 * branch here means no feature has to know the difference, and the two modes stay
 * testable as data rather than as deploy configurations.
 */
export function resolveCredentials(request: CredentialsRequest): FalCredentials {
  if (request.mode === 'saas') {
    if (!request.serverKey) throw new MissingCredentialsError('no-server-key')
    return { kind: 'server', key: request.serverKey }
  }

  if (!request.sealedUserKey) throw new MissingCredentialsError('no-user-key')
  const opened = unsealKey(request.sealedUserKey, request.encryptionKey)
  if (!opened.ok) {
    throw new MissingCredentialsError(
      opened.reason === 'expired' ? 'user-key-expired' : 'user-key-invalid',
    )
  }
  return { kind: 'user', key: opened.falKey, expiresAt: opened.expiresAt }
}
