import { timingSafeEqual } from 'node:crypto'
import { createBilling } from '@genny/billing/provider.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { sweepStrandedJobs } from '@genny/jobs/sweep.ts'
import { storage } from '@/features/storage.ts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Finishes generations whose browser went away. Meant for a scheduler: once a
 * minute is plenty, once an hour still beats never.
 *
 * GET as well as POST because most hosted cron products only send GET, and the
 * sweep is idempotent either way: a job it already settled is no longer stranded.
 */
export async function POST(request: Request): Promise<Response> {
  return run(request)
}

export const GET = POST

async function run(request: Request): Promise<Response> {
  const config = env()
  // No token configured means no scheduled work, and an unauthenticated endpoint
  // that touches every actor's jobs is not something to leave lying around.
  if (!config.CRON_SECRET) return new Response('not found', { status: 404 })
  if (!authorized(request, config.CRON_SECRET)) return new Response('no', { status: 401 })

  const db = appDb(config.DATABASE_URL)
  const report = await sweepStrandedJobs({
    db,
    ownerDb: ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL),
    // Only the deployment's own key can ask fal about someone else's job. In byok
    // the key left with the visitor, so the sweep can only expire.
    fal: config.FAL_KEY
      ? { credentials: { kind: 'server', key: config.FAL_KEY }, storage: storage() }
      : null,
    billing: createBilling(config.GENNY_MODE, db),
  })

  return Response.json(report)
}

function authorized(request: Request, secret: string): boolean {
  const offered = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const a = Buffer.from(offered)
  const b = Buffer.from(secret)
  // timingSafeEqual throws on a length mismatch, which is itself a leak of one
  // bit; comparing the lengths first keeps the answer uniform.
  return a.length === b.length && timingSafeEqual(a, b)
}
