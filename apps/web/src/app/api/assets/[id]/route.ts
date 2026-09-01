import { takenGroupLabels } from '@genny/assets/groups.ts'
import { toLabelSlug } from '@genny/assets/labels.ts'
import { renameAsset } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { deleteAssetFor } from '@/features/assets/server/delete.ts'
import { toView } from '@/features/assets/server/list.ts'
import { readActorId } from '@/features/session/actor.ts'

type Params = { params: Promise<{ id: string }> }

/**
 * Deleting and renaming one asset.
 *
 * A route rather than a server action for the same reason the upload is one:
 * these are called from the library's own client component with fetch, and the
 * result it needs back is the new row rather than a page revalidation.
 */
export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  const actorId = await readActorId()
  if (!actorId) return Response.json({ ok: false, reason: 'Not signed in.' }, { status: 401 })

  const outcome = await deleteAssetFor(actorId, (await params).id)
  return Response.json(outcome, { status: outcome.ok ? 200 : 404 })
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const actorId = await readActorId()
  if (!actorId) return Response.json({ ok: false, reason: 'Not signed in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const wanted = typeof body?.label === 'string' ? toLabelSlug(body.label) : ''
  if (!wanted || wanted === 'asset') {
    return Response.json({ ok: false, reason: 'That is not a usable handle.' }, { status: 400 })
  }

  const { id } = await params
  const renamed = await withActor(appDb(env().DATABASE_URL), actorId, async (tx) => {
    // Groups and assets share one namespace even though the database gives them
    // separate uniques: the dock resolves a prompt through a single map keyed by
    // label, so two things answering to `@hoodie` means one of them silently
    // never resolves. The database cannot check this, so the write path does.
    if ((await takenGroupLabels(tx)).includes(wanted)) return null
    return renameAsset(tx, id, wanted)
  }).catch(() => null)

  // Either a group has the name, or the (owner, label) unique refused it. Both
  // are a name somebody is already using rather than something a retry fixes.
  if (!renamed) {
    return Response.json({ ok: false, reason: 'That handle is taken.' }, { status: 409 })
  }
  return Response.json({ ok: true, asset: toView(renamed) })
}
