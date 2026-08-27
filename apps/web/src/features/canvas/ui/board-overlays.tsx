'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { NodeMenu, type NodeMenuTarget } from './node-menu.tsx'
import { NodePanel, type ReuseRequest } from './node-panel.tsx'

type Bounds = { width: number; height: number }

type OverlayProps = {
  menu: NodeMenuTarget | null
  inspected: CanvasNodeView | null
  model: PickableModel
  viewport: Viewport
  bounds: Bounds
  onAttach: (field: string, nodes: CanvasNodeView[]) => void
  onMention: (label: string) => void
  onReuse: (request: ReuseRequest) => void
  onRemove: (ids: string[]) => void
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
          model={props.model}
          bounds={props.bounds}
          onAttach={(field) => props.onAttach(field, menu.nodes)}
          onMention={() => {
            const only = menu.nodes[0]
            if (only?.label) props.onMention(only.label)
            props.onCloseMenu()
          }}
          onDelete={() => props.onRemove(menu.nodes.map((node) => node.id))}
          onClose={props.onCloseMenu}
        />
      ) : null}

      {inspected ? (
        <NodePanel
          node={inspected}
          viewport={props.viewport}
          bounds={props.bounds}
          onClose={props.onCloseInspector}
          onMention={props.onMention}
          onReuse={props.onReuse}
          onDelete={() => props.onRemove([inspected.id])}
        />
      ) : null}
    </>
  )
}
