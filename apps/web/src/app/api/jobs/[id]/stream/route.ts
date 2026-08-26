import { createBilling } from '@genny/billing/provider.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { findJob } from '@genny/db/repositories/jobs.ts'
import { env } from '@genny/env/env.ts'
import { readActorId } from '@/features/session/actor.ts'
import { readCredentials } from '@/features/session/fal-key.ts'
import { trackJob } from '@/features/studio/server/track-job.ts'

const POLL_INTERVAL_MS = 2500
const MAX_DURATION_MS = 5 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

/**
 * Streams a job's progress. Phase 1 has no webhook, so this route is the
 * authority: it polls the fal queue and writes the outcome to the job row.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actorId = await readActorId()
  if (!actorId) return new Response('no session', { status: 401 })

  const { id } = await params
  if (!UUID.test(id)) return new Response('bad id', { status: 400 })

  const db = appDb(env().DATABASE_URL)
  const job = await withActor(db, actorId, (tx) => findJob(tx, id))
  // RLS already scoped that read, so a miss means "not yours or not real". Both
  // answer 404: telling them apart tells a stranger what exists.
  if (!job) return new Response('not found', { status: 404 })

  const credentials = await readCredentials().catch(() => null)
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      send({ status: job.status, jobId: job.id })

      const trackable =
        (job.status === 'queued' || job.status === 'running') && credentials && job.falRequestId
      if (!trackable) return controller.close()

      for await (const event of trackJob({
        db,
        actorId,
        job: { ...job, falRequestId: job.falRequestId as string },
        credentials,
        billing: createBilling(env().GENNY_MODE, db),
        pollIntervalMs: POLL_INTERVAL_MS,
        deadline: Date.now() + MAX_DURATION_MS,
      })) {
        send(event)
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Proxies buffer event streams into uselessness otherwise.
      'x-accel-buffering': 'no',
    },
  })
}
