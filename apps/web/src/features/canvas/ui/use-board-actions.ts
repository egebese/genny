'use client'

import type { MediaKind } from '@genny/models/aspect.ts'
import { slotsAccepting } from '@genny/models/slots.ts'
import type { PickableFamily } from '../family-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { ReuseRequest } from './node-panel.tsx'
import type { Attachable, useAttachments } from './use-attachments.ts'
import type { useBoardHistory } from './use-board-history.ts'
import { useClipboard } from './use-clipboard.ts'
import type { useComposer } from './use-composer.ts'
import { overlaySlots } from './use-overlay-slots.ts'
import type { useSelection } from './use-selection.ts'
import type { useSurfaces } from './use-surfaces.ts'
import type { useViewport } from './use-viewport.ts'

type Deps = {
  canvasId: string
  family: PickableFamily
  nodes: CanvasNodeView[]
  pick: ReturnType<typeof useSelection>
  view: ReturnType<typeof useViewport>
  surfaces: ReturnType<typeof useSurfaces>
  pinned: ReturnType<typeof useAttachments>
  composer: ReturnType<typeof useComposer>
  board: ReturnType<typeof useBoardHistory>
}

/**
 * What the board does when something happens on it.
 *
 * Gathered out of the component because none of it is rendering: it is the
 * rules about what a click, a drag and a right-click mean once selection,
 * viewport, overlays and attachments all have an opinion.
 */
export function useBoardActions({
  canvasId,
  family,
  nodes,
  pick,
  view,
  surfaces,
  pinned,
  composer,
  board,
}: Deps) {
  const mention = (label: string) =>
    composer.setPrompt((current) =>
      current.trimEnd() ? `${current.trimEnd()} @${label} ` : `@${label} `,
    )

  const reuse = (request: ReuseRequest) => {
    const found = composer.familyOf(request.modelId)
    if (found) composer.choose(found)
    composer.setSettings(request.settings)
    composer.setPrompt(request.prompt)
  }

  /**
   * The slot came from the family, so the endpoint that owns it is the one being
   * attached to; whatever is resolved right now may not have that field, since
   * before the first attachment it is the text-only task.
   *
   * Then everything is laid out again, because adding one can move the others: a
   * second image takes PixVerse from its animator to its transition, and the
   * first stops being "the image" and becomes the first frame.
   */
  const attachTo = (field: string, chosen: readonly Attachable[]) => {
    const owner = family.variants.find((variant) =>
      variant.slots.some((slot) => slot.field === field),
    )
    if (owner) pinned.attach(owner, field, chosen)
    pinned.relayout(family)
  }

  const select = (id: string, additive: boolean) => {
    pick.select(id, additive)
    surfaces.clear()
  }

  /**
   * Dragging something already picked moves the whole selection; dragging
   * anything else moves that one alone.
   *
   * This reads the selection as it was before the click that started the drag,
   * which is what makes the second case work: the click collapses the selection
   * to this node and that setter has not landed yet.
   */
  const startDrag = (id: string) =>
    board.beginDrag(pick.selected.has(id) ? [...pick.selected] : [id])

  /** Right-clicking outside the selection acts on what was clicked, the way it
   * does everywhere else, rather than on what happened to be picked. */
  const openMenu = (id: string, at: { clientX: number; clientY: number }) => {
    const chosen = pick.selected.has(id) ? [...pick.selected] : [id]
    if (!pick.selected.has(id)) pick.select(id, false)
    surfaces.openMenu(
      view.toLocal(at),
      nodes.filter((node) => chosen.includes(node.id)),
    )
  }

  /** Nothing under the pointer, so the menu opens with nothing selected and
   * offers the one thing that still makes sense there. */
  const openBoardMenu = (at: { clientX: number; clientY: number }) => {
    pick.clear()
    surfaces.openMenu(view.toLocal(at), [])
  }

  const pan = (event: React.PointerEvent) => {
    surfaces.clear()
    view.startPan(event)
  }

  const marquee = (event: React.PointerEvent, additive: boolean) => {
    surfaces.clear()
    pick.startMarquee(event, additive)
  }

  /**
   * The same attach, from the shelf, where nobody picked a slot.
   *
   * The slots are the ones the endpoint would have *with this item added*, not
   * the ones it has now. Asked the other way round, a text-to-image model with
   * nothing attached reports no slots at all, because before the first image it
   * is the text-only task, and clicking a product shot did nothing at all.
   */
  const attachMedia = (item: Attachable, carrying: readonly MediaKind[]) => {
    const slots = overlaySlots(family, carrying, [item])
    const slot = item.kind ? slotsAccepting(slots, item.kind)[0] : undefined
    if (slot) attachTo(slot.field, [item])
  }

  const attachAndClose = (field: string, chosen: readonly Attachable[]) => {
    attachTo(field, chosen)
    surfaces.closeMenu()
  }

  const removeNodes = (ids: string[]) => {
    // One history entry for the whole selection: deleting six nodes and then
    // pressing undo six times is not undo, it is bookkeeping.
    board.removeMany(ids)
    pick.clear()
    surfaces.clear()
  }

  const clipboard = useClipboard({
    canvasId,
    nodes,
    selected: pick.selected,
    view,
    // `paste`, not `absorb`: both take a whole board back from the server, and
    // this is the seam that tells "a person pasted these" from "a generation
    // finished". Only the first belongs in the history.
    absorb: board.paste,
    remove: removeNodes,
  })

  return {
    clipboard,
    select,
    startDrag,
    openMenu,
    openBoardMenu,
    pan,
    marquee,
    attachTo,
    attachMedia,
    attachAndClose,
    removeNodes,
    mention,
    reuse,
  }
}
