import { type Env, envSchema } from './schema.ts'

/**
 * Parses an explicit source object. Kept separate from process.env so tests and
 * tooling can validate a configuration without mutating the real environment.
 * Throws with every offending key listed, because fixing one variable per
 * restart is how people give up on self-hosting.
 */
export function parseEnv(source: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(source)
  if (parsed.success) return parsed.data
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
  throw new Error(`Invalid environment:\n${lines.join('\n')}\n\nSee .env.example.`)
}

let cached: Env | undefined

export function env(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

export function isSaas(): boolean {
  return env().GENNY_MODE === 'saas'
}

/** Test-only escape hatch so suites can swap environments without reimporting. */
export function resetEnvCache(): void {
  cached = undefined
}
