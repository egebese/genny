import { deleteCharacter } from '@genny/assets/characters.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { createCharacterFor } from '@/features/assets/server/create-character.ts'
import { ensureActorId, readActorId } from '@/features/session/actor.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request): Promise<Response> {
  const actorId = await ensureActorId()
  const body = (await request.json().catch(() => null)) as {
    label?: unknown
    assetIds?: unknown
  } | null

  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  const assetIds = Array.isArray(body?.assetIds)
    ? body.assetIds.filter((id): id is string => typeof id === 'string' && UUID.test(id))
    : []

  if (!label) return Response.json({ ok: false, reason: 'Give it a name.' }, { status: 400 })

  const outcome = await createCharacterFor(actorId, { label, assetIds })
  if (!outcome.ok) {
    return Response.json({ ok: false, reason: outcome.reason }, { status: outcome.status })
  }
  return Response.json({ ok: true, character: outcome.character })
}

export async function DELETE(request: Request): Promise<Response> {
  const actorId = await readActorId()
  if (!actorId) return Response.json({ ok: false }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID.test(id)) return Response.json({ ok: false }, { status: 400 })

  // RLS decides whether this is deletable; a miss and a stranger's id look the
  // same from here, which is the point.
  const removed = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    deleteCharacter(tx, id),
  )
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 })
}
