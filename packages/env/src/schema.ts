import { z } from 'zod'

/**
 * `KEY=` in a .env file is an empty string, not an absent value, so a plain
 * `.optional()` rejects it. Every real .env has commented-out or blank optional
 * entries, so treat blank as absent instead of as invalid.
 */
const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
)

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
)

/** 32 raw bytes, base64 encoded. Anything shorter is not a key, it is a typo. */
const secret32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length >= 32, 'must be >= 32 bytes of base64')

const base = z.object({
  GENNY_MODE: z.enum(['byok', 'saas']),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url(),
  AUTH_SECRET: secret32,
  GENNY_ENCRYPTION_KEY: secret32,

  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_MIGRATION_URL: optionalText,

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  S3_PUBLIC_URL: z.url(),

  FAL_KEY: optionalText,

  CREDIT_PER_USD: z.coerce.number().int().positive().default(1000),
  CREDIT_SIGNUP_GRANT: z.coerce.number().int().nonnegative().default(0),

  STRIPE_SECRET_KEY: optionalText,
  STRIPE_WEBHOOK_SECRET: optionalText,

  AUTH_GOOGLE_ID: optionalText,
  AUTH_GOOGLE_SECRET: optionalText,

  REDIS_URL: optionalUrl,
})

/**
 * saas mode needs things byok mode must never require. Enforcing it here means
 * no feature has to re-check, and a misconfigured saas deploy dies at boot
 * rather than at the first paid generation.
 */
export const envSchema = base.superRefine((env, ctx) => {
  if (env.GENNY_MODE !== 'saas') return
  for (const key of ['FAL_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const) {
    if (!env[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required when GENNY_MODE=saas`,
      })
    }
  }
})

export type Env = z.infer<typeof base>
