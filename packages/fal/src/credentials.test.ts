import { describe, expect, it } from 'vitest'
import { MissingCredentialsError, resolveCredentials } from './credentials.ts'
import { sealKey } from './key-cipher.ts'

const encryptionKey = Buffer.alloc(32, 5).toString('base64')
const userKey = 'user-id:user-secret'

describe('resolveCredentials', () => {
  it('uses the server key in saas mode', () => {
    const result = resolveCredentials({ mode: 'saas', serverKey: 'srv:key', encryptionKey })
    expect(result).toEqual({ kind: 'server', key: 'srv:key' })
  })

  it('ignores a user cookie in saas mode, so nobody can shift the bill', () => {
    const result = resolveCredentials({
      mode: 'saas',
      serverKey: 'srv:key',
      sealedUserKey: sealKey(userKey, encryptionKey, 60),
      encryptionKey,
    })
    expect(result).toEqual({ kind: 'server', key: 'srv:key' })
  })

  it('fails loudly when saas mode has no server key', () => {
    expect(() => resolveCredentials({ mode: 'saas', encryptionKey })).toThrow(
      MissingCredentialsError,
    )
  })

  it('uses the sealed visitor key in byok mode', () => {
    const result = resolveCredentials({
      mode: 'byok',
      sealedUserKey: sealKey(userKey, encryptionKey, 60),
      encryptionKey,
    })
    expect(result).toMatchObject({ kind: 'user', key: userKey })
  })

  it('never falls back to the server key in byok mode', () => {
    expect(() => resolveCredentials({ mode: 'byok', serverKey: 'srv:key', encryptionKey })).toThrow(
      /no-user-key/,
    )
  })

  it('distinguishes an expired key from an invalid one, for a useful prompt', () => {
    const expired = sealKey(userKey, encryptionKey, -1)
    expect(() =>
      resolveCredentials({ mode: 'byok', sealedUserKey: expired, encryptionKey }),
    ).toThrow(/user-key-expired/)
    expect(() =>
      resolveCredentials({ mode: 'byok', sealedUserKey: 'garbage', encryptionKey }),
    ).toThrow(/user-key-invalid/)
  })
})
