import { ownerDb } from '@genny/db/connection.ts'
import { pingDatabase } from '@genny/db/health.ts'
import { oldestUnsettledAgeMs } from '@genny/db/repositories/jobs-settlement.ts'
import { env } from '@genny/env/env.ts'
import { ABANDON_AFTER_MS } from '@genny/jobs/sweep.ts'
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
  checks.push(await checkSweep())

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
 * Whether anything is finishing the generations the browser walked away from.
 *
 * The sweep is the only thing that returns credits held for a job nobody is
 * watching, and it only runs if a scheduler calls it. Nothing in the code can
 * see a scheduler, so this asks the question from the other end: a job still
 * unsettled long past the abandon window means no sweep has run, and every one
 * of them is sitting on someone's money.
 *
 * Only a fault in saas. byok holds nothing, because the visitor is spending
 * their own fal balance, so an unswept job there is a stale spinner rather than
 * money going missing, and failing health over it would call every correctly
 * configured byok deployment broken.
 */
async function checkSweep(): Promise<Check> {
  const name = 'sweep'
  try {
    const config = env()
    if (config.GENNY_MODE !== 'saas') return { name, ok: true, detail: 'byok holds no credits' }
    if (!config.CRON_SECRET) {
      return { name, ok: false, detail: 'CRON_SECRET unset, so held credits are never returned' }
    }
    const db = ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL)
    const age = await oldestUnsettledAgeMs(db)
    if (age === null || age < STALE_SWEEP_AFTER_MS) return { name, ok: true }
    return { name, ok: false, detail: `a job has been unsettled for ${Math.round(age / 60000)}m` }
  } catch (error) {
    return { name, ok: false, detail: firstLine(error) }
  }
}

/** Twice the abandon window: one whole window may pass before the sweep is even
 * allowed to write a job off, so anything under that is not yet evidence. */
const STALE_SWEEP_AFTER_MS = ABANDON_AFTER_MS * 2

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
