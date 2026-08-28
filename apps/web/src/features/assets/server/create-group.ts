import {
  createGroup,
  type GroupKind,
  type GroupRecord,
  takenGroupLabels,
} from '@genny/assets/groups.ts'
import { toLabelSlug, uniqueLabel } from '@genny/assets/labels.ts'
import { assetUrl } from '@genny/assets/urls.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import type { MentionableView } from './list.ts'

export type CreateGroupOutcome =
  | { ok: true; group: MentionableView }
  | { ok: false; reason: string; status: number }

/**
 * A group is a handle, a kind, and an ordered set of assets. The database
 * guarantees they belong to this actor through a composite foreign key, so this
 * only has to turn a wish into a valid row and a readable error.
 */
export async function createGroupFor(
  actorId: string,
  input: { label: string; kind?: GroupKind | undefined; assetIds: string[] },
): Promise<CreateGroupOutcome> {
  if (input.assetIds.length === 0) {
    return { ok: false, reason: 'Pick at least one image first.', status: 400 }
  }
  if (input.assetIds.length > 16) {
    return { ok: false, reason: 'A group takes at most 16 images.', status: 400 }
  }

  const db = appDb(env().DATABASE_URL)

  try {
    const group = await withActor(db, actorId, async (tx) => {
      const label = uniqueLabel(toLabelSlug(input.label), await takenGroupLabels(tx))
      return createGroup(tx, {
        ownerId: actorId,
        label,
        assetIds: input.assetIds,
        ...(input.kind ? { kind: input.kind } : {}),
      })
    })
    return { ok: true, group: toMentionable(group) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create that group.'
    // The composite foreign key is what actually stops a cross-owner bundle; this
    // turns its constraint violation into something a person can act on.
    const notYours = /not yours|violates foreign key/i.test(message)
    return {
      ok: false,
      reason: notYours ? 'One of those images is not yours.' : 'Could not create that group.',
      status: notYours ? 403 : 400,
    }
  }
}

function toMentionable(group: GroupRecord): MentionableView {
  const first = group.members[0]
  return {
    id: group.id,
    label: group.label,
    kind: 'group',
    // A group is a set of reference images, which is what a group is for.
    media: 'image',
    previewUrl: first
      ? assetUrl({ id: first.assetId, label: group.label, storageKey: first.storageKey })
      : null,
    count: group.members.length,
  }
}
