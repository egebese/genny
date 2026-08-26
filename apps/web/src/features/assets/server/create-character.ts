import {
  type CharacterRecord,
  createCharacter,
  takenCharacterLabels,
} from '@genny/assets/characters.ts'
import { publicUrlFor } from '@genny/assets/keys.ts'
import { toLabelSlug, uniqueLabel } from '@genny/assets/labels.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import type { MentionableView } from './list.ts'

export type CreateCharacterOutcome =
  | { ok: true; character: MentionableView }
  | { ok: false; reason: string; status: number }

/**
 * A character is a handle plus an ordered set of reference images. The database
 * guarantees the assets belong to this actor through a composite foreign key, so
 * this only has to turn a wish into a valid row and a readable error.
 */
export async function createCharacterFor(
  actorId: string,
  input: { label: string; assetIds: string[] },
): Promise<CreateCharacterOutcome> {
  if (input.assetIds.length === 0) {
    return { ok: false, reason: 'Pick at least one image first.', status: 400 }
  }
  if (input.assetIds.length > 16) {
    return { ok: false, reason: 'A character takes at most 16 images.', status: 400 }
  }

  const db = appDb(env().DATABASE_URL)

  try {
    const character = await withActor(db, actorId, async (tx) => {
      const label = uniqueLabel(toLabelSlug(input.label), await takenCharacterLabels(tx))
      return createCharacter(tx, { ownerId: actorId, label, assetIds: input.assetIds })
    })
    return { ok: true, character: toMentionable(character) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create that character.'
    // The composite foreign key is what actually stops a cross-owner bundle; this
    // turns its constraint violation into something a person can act on.
    const notYours = /not yours|violates foreign key/i.test(message)
    return {
      ok: false,
      reason: notYours ? 'One of those images is not yours.' : 'Could not create that character.',
      status: notYours ? 403 : 400,
    }
  }
}

function toMentionable(character: CharacterRecord): MentionableView {
  const first = character.members[0]
  return {
    id: character.id,
    label: character.label,
    kind: 'character',
    previewUrl: first ? publicUrlFor(env().S3_PUBLIC_URL, first.storageKey) : null,
    count: character.members.length,
  }
}
