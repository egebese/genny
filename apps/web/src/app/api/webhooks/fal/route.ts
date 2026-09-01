import { createBilling } from '@genny/billing/provider.ts'
import { appDb, ownerDb } from '@genny/db/connection.ts'
import { findJobByFalRequestId } from '@genny/db/repositories/jobs-settlement.ts'
import { env } from '@genny/env/env.ts'
import { logger } from '@genny/env/log.ts'
import { falPublicKeys } from '@genny/fal/jwks.ts'
import { verifyFalWebhook } from '@genny/fal/webhook.ts'
import { settleOnce } from '@genny/jobs/track.ts'
import { storage } from '@/features/storage.ts'

export const dynamic = 'force-dynamic'

/**
 * fal telling us a generation finished, so the result is written even if nobody
 * is watching. The stream still works and the reconcile sweep still runs: this
 * is the fast path, not the only one.
 *
 * Registered only in saas mode, where the key is ours. A byok generation is
 * settled by the visitor's own stream, because their key left with them.
 */
export async function POST(request: Request): Promise<Response> {
  const config = env()
  if (config.GENNY_MODE !== 'saas' || !config.FAL_KEY) {
    return new Response('not found', { status: 404 })
  }

  // Cheap first: an unsigned request should not cost a round trip to fal's key
  // endpoint, which is exactly what makes that round trip worth attacking.
  if (!request.headers.get('x-fal-webhook-signature')) {
    return new Response('invalid signature', { status: 401 })
  }

  // The raw text, not request.json(): the signature covers the bytes fal sent,
  // and a parse-and-restringify changes them.
  const rawBody = await request.text()
  const verified = verifyFalWebhook({
    headers: request.headers,
    rawBody,
    keys: await falPublicKeys(),
  })
  if (!verified.ok) {
    // A rejection here is either a misconfigured deployment or someone trying
    // to settle a job they do not own, and both used to leave no trace at all.
    log.warn('webhook signature rejected', { reason: verified.reason })
    return new Response(verified.reason, { status: 401 })
  }

  const job = await findJobByFalRequestId(
    ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL),
    verified.event.requestId,
  )
  // Unknown request, or one already settled by the stream. Both are a 200: fal
  // retries anything else, and there is nothing left to do either way.
  if (!job || job.status === 'completed' || job.status === 'failed') return ok()

  const db = appDb(config.DATABASE_URL)
  await settleOnce({
    db,
    actorId: job.ownerId,
    job: { ...job, falRequestId: verified.event.requestId },
    credentials: { kind: 'server', key: config.FAL_KEY },
    billing: createBilling('saas', db),
    storage: storage(),
  })
  return ok()
}

function ok(): Response {
  return new Response(null, { status: 204 })
}

const log = logger('webhook')
