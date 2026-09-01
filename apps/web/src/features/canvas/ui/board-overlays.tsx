'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import type { ReferenceSlot } from '@genny/models/slots.ts'
import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { type ClipboardActions, NodeMenu, type NodeMenuTarget } from './node-menu.tsx'
import { NodePanel, type ReuseRequest } from './node-panel.tsx'

type Bounds = { width: number; height: number }

type OverlayProps = {
  menu: NodeMenuTarget | null
  inspected: CanvasNodeView | null
  /** The chosen model, which is what the menu's items come from. */
  family: PickableFamily
  slotsForAdding: ReferenceSlot[]
  /** Every endpoint, so the panel can mark whichever one made the node it shows. */
  models: PickableModel[]
  showCost: boolean
  viewport: Viewport
  bounds: Bounds
  onAttach: (field: string, nodes: CanvasNodeView[]) => void
  onMention: (label: string) => void
  onVariants: (node: CanvasNodeView) => void
  onReuse: (request: ReuseRequest) => void
  onRemove: (ids: string[]) => void
  onCancel: (jobId: string) => void
  clipboard: ClipboardActions
  onCloseMenu: () => void
  onCloseInspector: () => void
}

/**
 * Everything that floats over the board, in one place so the rule that only one
 * of them shows at a time is visible rather than implied.
 */
export function BoardOverlays(props: OverlayProps) {
  const { menu, inspected } = props

  return (
    <>
      {menu ? (
        <NodeMenu
          target={menu}
          family={props.family}
          slotsForAdding={props.slotsForAdding}
          bounds={props.bounds}
          onAttach={(field) => props.onAttach(field, menu.nodes)}
          onMention={() => {
            const only = menu.nodes[0]
            if (only?.label) props.onMention(only.label)
            props.onCloseMenu()
          }}
          onVariants={variantsOf(menu.nodes, props.onVariants)}
          onDelete={() => props.onRemove(menu.nodes.map((node) => node.id))}
          clipboard={props.clipboard}
          onClose={props.onCloseMenu}
        />
      ) : null}

      {inspected ? (
        <NodePanel
          node={inspected}
          models={props.models}
          showCost={props.showCost}
          viewport={props.viewport}
          bounds={props.bounds}
          onClose={props.onCloseInspector}
          onMention={props.onMention}
          onReuse={props.onReuse}
          onCancel={() => inspected.jobId && props.onCancel(inspected.jobId)}
          onDelete={() => props.onRemove([inspected.id])}
        />
      ) : null}
    </>
  )
}

/**
 * Whether varying makes sense here, and what it does if so.
 *
 * One finished still. The server has the real answer, since it knows whether
 * the model that made this has an endpoint that takes an image back, and it
 * says so for free without asking an agent. What is checked here is only the
 * part the board already knows: four variants of a running placeholder, or of a
 * sound, is not a question worth sending.
 */
function variantsOf(
  chosen: CanvasNodeView[],
  run: (node: CanvasNodeView) => void,
): (() => void) | null {
  const only = chosen.length === 1 ? chosen[0] : null
  if (!only || only.kind !== 'image' || only.status !== 'ready') return null
  return () => run(only)
}
