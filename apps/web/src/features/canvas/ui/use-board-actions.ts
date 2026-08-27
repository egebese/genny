'use client'

import type { PickableFamily } from '../family-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { ReuseRequest } from './node-panel.tsx'
import type { useAttachments } from './use-attachments.ts'
import type { useComposer } from './use-composer.ts'
import type { useSelection } from './use-selection.ts'
import type { useSurfaces } from './use-surfaces.ts'
import type { useViewport } from './use-viewport.ts'

type Deps = {
  family: PickableFamily
  nodes: CanvasNodeView[]
  pick: ReturnType<typeof useSelection>
  view: ReturnType<typeof useViewport>
  surfaces: ReturnType<typeof useSurfaces>
  pinned: ReturnType<typeof useAttachments>
  composer: ReturnType<typeof useComposer>
  beginDrag: (ids: readonly string[]) => void
  remove: (id: string) => void
}

/**
 * What the board does when something happens on it.
 *
 * Gathered out of the component because none of it is rendering: it is the
 * rules about what a click, a drag and a right-click mean once selection,
 * viewport, overlays and attachments all have an opinion.
 */
export function useBoardActions({
  family,
  nodes,
  pick,
  view,
  surfaces,
  pinned,
  composer,
  beginDrag,
  remove,
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
  const attachTo = (field: string, chosen: CanvasNodeView[]) => {
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
  const startDrag = (id: string) => beginDrag(pick.selected.has(id) ? [...pick.selected] : [id])

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

  const pan = (event: React.PointerEvent) => {
    surfaces.clear()
    view.startPan(event)
  }

  const marquee = (event: React.PointerEvent, additive: boolean) => {
    surfaces.clear()
    pick.startMarquee(event, additive)
  }

  const attachAndClose = (field: string, chosen: CanvasNodeView[]) => {
    attachTo(field, chosen)
    surfaces.closeMenu()
  }

  const removeNodes = (ids: string[]) => {
    for (const id of ids) remove(id)
    pick.clear()
    surfaces.clear()
  }

  return {
    select,
    startDrag,
    openMenu,
    pan,
    marquee,
    attachTo,
    attachAndClose,
    removeNodes,
    mention,
    reuse,
  }
}
