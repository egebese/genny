import { readActorId } from '@/features/session/actor.ts'
import { historyPage } from '@/features/studio/server/history.ts'

const MODALITIES = ['image', 'video', 'audio'] as const

/** One page of history, for the feed's "load older". */
export async function GET(request: Request): Promise<Response> {
  // Input is validated before anything else, including before the session is
  // read: a malformed cursor is malformed whether or not anyone is signed in.
  const params = new URL(request.url).searchParams
  const cursor = params.get('before')
  const before = cursor ? new Date(cursor) : undefined
  if (before && Number.isNaN(before.getTime())) {
    return Response.json({ error: 'bad cursor' }, { status: 400 })
  }

  const asked = params.get('modality')
  if (asked && !MODALITIES.some((name) => name === asked)) {
    return Response.json({ error: 'bad modality' }, { status: 400 })
  }
  // An unfiltered page is the history route's view: everything, newest first.
  const modality = MODALITIES.find((name) => name === asked)

  const actorId = await readActorId()
  if (!actorId) return Response.json({ items: [], nextCursor: null })

  return Response.json(await historyPage(actorId, { modality, before }))
}
