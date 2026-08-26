import { readActorId } from '@/features/session/actor.ts'
import { historyPage } from '@/features/studio/server/history.ts'

/** One page of history, for the feed's "load older". */
export async function GET(request: Request): Promise<Response> {
  // Input is validated before anything else, including before the session is
  // read: a malformed cursor is malformed whether or not anyone is signed in.
  const cursor = new URL(request.url).searchParams.get('before')
  const before = cursor ? new Date(cursor) : undefined
  if (before && Number.isNaN(before.getTime())) {
    return Response.json({ error: 'bad cursor' }, { status: 400 })
  }

  const actorId = await readActorId()
  if (!actorId) return Response.json({ items: [], nextCursor: null })

  return Response.json(await historyPage(actorId, before))
}
