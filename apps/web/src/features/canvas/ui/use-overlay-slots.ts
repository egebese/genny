'use client'

import type { MediaKind } from '@genny/models/aspect.ts'
import type { ReferenceSlot } from '@genny/models/slots.ts'
import { type PickableFamily, taskFor } from '../family-list.ts'
import type { Attachable } from './use-attachments.ts'

/**
 * Where the right-click menu's items come from.
 *
 * The endpoint this model would run once the nodes under the cursor were added,
 * not the union of every endpoint in the family. The union listed "use as start
 * frame" twice on PixVerse, whose animator and whose transition each declare one
 * and they are different fields.
 *
 * Asking what would actually run answers both questions at once: with nothing
 * attached it is the animator and offers one frame, with one already attached it
 * is the transition and offers two.
 */
export function overlaySlots(
  family: PickableFamily,
  carrying: readonly MediaKind[],
  about: readonly Attachable[],
): ReferenceSlot[] {
  const adding = about.map((item) => item.kind).filter((kind) => kind !== null)
  return taskFor(family, [...carrying, ...adding])?.slots ?? []
}
