/**
 * Values that must never reach a log line, an error message or a response body.
 * The BYOK fal key is the sharpest one: it is someone else's money.
 */
const SECRET_KEYS = [
  'AUTH_SECRET',
  'GENNY_ENCRYPTION_KEY',
  'DATABASE_URL',
  'DATABASE_MIGRATION_URL',
  'S3_SECRET_ACCESS_KEY',
  'FAL_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'AUTH_GOOGLE_SECRET',
  'falKey',
  'apiKey',
  'authorization',
  'password',
  'token',
]

const secretKeySet = new Set(SECRET_KEYS.map((k) => k.toLowerCase()))

/** fal keys look like `<uuid>:<hex>`. Catch them even under an innocent key name. */
const FAL_KEY_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{16,}/gi

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]'
  if (typeof value === 'string') return value.replace(FAL_KEY_PATTERN, '[redacted]')
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = secretKeySet.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  return value
}
