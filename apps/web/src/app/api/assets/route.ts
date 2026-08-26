import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { createPostgresLimiter } from '@genny/ratelimit/postgres-limiter.ts'
import { ruleFor } from '@genny/ratelimit/rules.ts'
import { listAssetsFor, toView } from '@/features/assets/server/list.ts'
import { uploadAsset } from '@/features/assets/server/upload.ts'
import { ensureActorId, readActorId } from '@/features/session/actor.ts'

/*
 * A route handler, not a server action: the body carries a file, and a multipart
 * upload through an action would be serialized into the RSC payload.
 */
export async function POST(request: Request): Promise<Response> {
  const actorId = await ensureActorId()

  const verdict = await createPostgresLimiter(appDb(env().DATABASE_URL)).check(
    ruleFor('upload', actorId),
  )
  if (!verdict.allowed) {
    return Response.json({ ok: false, reason: 'Too many uploads for now.' }, { status: 429 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ ok: false, reason: 'No file was sent.' }, { status: 400 })
  }

  const label = form?.get('label')
  const outcome = await uploadAsset(
    actorId,
    file,
    typeof label === 'string' && label.trim() ? label.trim() : undefined,
  )
  if (!outcome.ok) {
    return Response.json({ ok: false, reason: outcome.reason }, { status: outcome.status })
  }
  return Response.json({ ok: true, asset: toView(outcome.asset) })
}

export async function GET(request: Request): Promise<Response> {
  const actorId = await readActorId()
  if (!actorId) return Response.json({ assets: [] })

  const kind = new URL(request.url).searchParams.get('kind')
  const assets = await listAssetsFor(actorId, {
    kind: kind === 'image' || kind === 'video' || kind === 'audio' ? kind : undefined,
  })
  return Response.json({ assets })
}
