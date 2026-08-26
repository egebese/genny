import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.ts'

const KEY = Buffer.alloc(32, 7).toString('base64')

const byok = {
  GENNY_MODE: 'byok',
  APP_URL: 'http://localhost:3000',
  AUTH_SECRET: KEY,
  GENNY_ENCRYPTION_KEY: KEY,
  DATABASE_URL: 'postgresql://u:p@localhost:5432/genny',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'genny',
  S3_ACCESS_KEY_ID: 'genny',
  S3_SECRET_ACCESS_KEY: 'gennygenny',
  S3_PUBLIC_URL: 'http://localhost:9000/genny',
}

function catchError(fn: () => unknown): Error {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error('expected the call to throw, it did not')
}

describe('parseEnv', () => {
  it('accepts a minimal byok configuration and applies credit defaults', () => {
    const env = parseEnv(byok)
    expect(env.GENNY_MODE).toBe('byok')
    expect(env.CREDIT_PER_USD).toBe(1000)
    expect(env.S3_FORCE_PATH_STYLE).toBe(false)
  })

  it('rejects an encryption key shorter than 32 bytes', () => {
    const error = catchError(() => parseEnv({ ...byok, GENNY_ENCRYPTION_KEY: 'dGlueQ==' }))
    expect(error.message).toContain('GENNY_ENCRYPTION_KEY')
  })

  it('rejects a database url that is not postgres', () => {
    const error = catchError(() => parseEnv({ ...byok, DATABASE_URL: 'mysql://x' }))
    expect(error.message).toContain('DATABASE_URL')
  })

  it('reports every missing saas secret at once, not one per restart', () => {
    const error = catchError(() => parseEnv({ ...byok, GENNY_MODE: 'saas' }))
    expect(error.message).toContain('FAL_KEY is required when GENNY_MODE=saas')
    expect(error.message).toContain('STRIPE_SECRET_KEY is required when GENNY_MODE=saas')
    expect(error.message).toContain('STRIPE_WEBHOOK_SECRET is required when GENNY_MODE=saas')
  })

  it('does not require saas secrets in byok mode', () => {
    expect(() => parseEnv(byok)).not.toThrow()
  })

  it('accepts saas mode once its secrets are present', () => {
    const env = parseEnv({
      ...byok,
      GENNY_MODE: 'saas',
      FAL_KEY: 'id:secret',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
    })
    expect(env.GENNY_MODE).toBe('saas')
  })

  it('never echoes a secret value back in the error message', () => {
    const error = catchError(() =>
      parseEnv({ ...byok, GENNY_MODE: 'saas', FAL_KEY: 'id:supersecret' }),
    )
    expect(error.message).not.toContain('supersecret')
  })

  it('treats an empty REDIS_URL as absent rather than invalid', () => {
    expect(() => parseEnv({ ...byok, REDIS_URL: '' })).not.toThrow()
  })
})

describe('blank optional values', () => {
  it('treats a blank optional entry as absent, the way every real .env has them', () => {
    const env = parseEnv({
      ...byok,
      FAL_KEY: '',
      STRIPE_SECRET_KEY: '',
      AUTH_GOOGLE_ID: '   ',
      REDIS_URL: '',
      DATABASE_MIGRATION_URL: '',
    })
    expect(env.FAL_KEY).toBeUndefined()
    expect(env.STRIPE_SECRET_KEY).toBeUndefined()
    expect(env.AUTH_GOOGLE_ID).toBeUndefined()
    expect(env.REDIS_URL).toBeUndefined()
  })

  it('still refuses saas mode when its secrets are blank rather than missing', () => {
    const error = catchError(() => parseEnv({ ...byok, GENNY_MODE: 'saas', FAL_KEY: '' }))
    expect(error.message).toContain('FAL_KEY is required when GENNY_MODE=saas')
  })

  it('rejects a malformed url that is not blank', () => {
    const error = catchError(() => parseEnv({ ...byok, REDIS_URL: 'not-a-url' }))
    expect(error.message).toContain('REDIS_URL')
  })
})
