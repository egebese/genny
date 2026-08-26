import { pingDatabase } from '@genny/db/health.ts'
import { env } from '@genny/env/env.ts'
import { loadCatalog } from '@genny/models/catalog.ts'

type Check = { name: string; ok: boolean; detail?: string }

/**
 * Answers the only question that matters on a fresh clone: is this thing wired
 * up? Each dependency is reported separately, because "unhealthy" without saying
 * which part is unhealthy is the same as no answer.
 *
 * Deliberately reveals no configuration values, only whether each check passed.
 */
export async function GET(): Promise<Response> {
  const checks: Check[] = []
  let mode = 'unknown'

  try {
    mode = env().GENNY_MODE
    checks.push({ name: 'env', ok: true })
  } catch (error) {
    checks.push({ name: 'env', ok: false, detail: firstLine(error) })
  }

  try {
    const entries = await loadCatalog()
    checks.push({ name: 'catalog', ok: entries.length > 0, detail: `${entries.length} models` })
  } catch (error) {
    checks.push({ name: 'catalog', ok: false, detail: firstLine(error) })
  }

  checks.push(await checkDatabase())

  const ok = checks.every((check) => check.ok)
  return Response.json({ ok, mode, checks }, { status: ok ? 200 : 503 })
}

async function checkDatabase(): Promise<Check> {
  try {
    await pingDatabase(env().DATABASE_URL)
    return { name: 'database', ok: true }
  } catch (error) {
    return { name: 'database', ok: false, detail: firstLine(error) }
  }
}

/**
 * The caller gets one short line; the operator gets the whole thing in the server
 * log. Returning a stack or a connection string to an unauthenticated caller is
 * how a health endpoint becomes a reconnaissance endpoint.
 */
function firstLine(error: unknown): string {
  console.error('[health] check failed', error)
  const message = error instanceof Error ? error.message : 'unknown error'
  return message.split('\n')[0]?.slice(0, 120) ?? 'unknown error'
}
