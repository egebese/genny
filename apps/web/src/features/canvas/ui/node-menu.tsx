'use client'

import { anchorPanel } from '@genny/canvas/anchor.ts'
import type { Point } from '@genny/canvas/geometry.ts'
import { slotsAccepting } from '@genny/models/slots.ts'
import { cn } from '@genny/ui/cn.ts'
import { useEffect, useRef } from 'react'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'

const MENU = { width: 232, height: 260 }

export type NodeMenuTarget = { at: Point; nodes: CanvasNodeView[] }

type NodeMenuProps = {
  target: NodeMenuTarget
  model: PickableModel
  bounds: { width: number; height: number }
  onAttach: (field: string) => void
  onMention: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Right-click on the board.
 *
 * The interesting half is that its items come from the selected model's own
 * catalog entry rather than from a list in here. An image-to-video endpoint that
 * declares a start and an end frame offers both; one that declares neither
 * offers neither, and a model added next month brings its own items.
 */
export function NodeMenu(props: NodeMenuProps) {
  const { target, model } = props
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menu.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && props.onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])

  const kinds = new Set(target.nodes.map((node) => node.kind).filter((kind) => kind !== null))
  // One kind at a time. A selection of a still and a clip has no slot that takes
  // both, and an item that silently drops half the picks is worse than no item.
  const kind = kinds.size === 1 ? [...kinds][0] : null
  const slots = kind ? slotsAccepting(model.slots, kind) : []
  const count = target.nodes.length

  const position = anchorPanel({ ...target.at, width: 0, height: 0 }, MENU, props.bounds, 8)

  return (
    <div
      ref={menu}
      role="menu"
      data-overlay
      tabIndex={-1}
      aria-label="Result actions"
      style={{ left: position.x, top: position.y, width: MENU.width }}
      className="absolute z-30 flex flex-col overflow-hidden rounded-(--radius-control) border border-line bg-surface/95 py-1 shadow-(--shadow-dock) outline-none backdrop-blur"
    >
      <p className="px-3 py-1 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
        {count === 1 ? (kind ?? 'result') : `${count} selected`}
      </p>

      {slots.map((slot) => (
        <Item
          key={slot.field}
          onClick={() => props.onAttach(slot.field)}
          disabled={!slot.array && count > 1}
        >
          {slot.array && count > 1 ? `${slot.label} (${count})` : slot.label}
        </Item>
      ))}

      {slots.length === 0 ? (
        <p className="px-3 py-2 text-ink-faint text-xs">
          {kind ? `${model.displayName} takes no ${kind}.` : 'Pick one kind of result at a time.'}
        </p>
      ) : null}

      <hr className="my-1 border-line" />
      <Item onClick={props.onMention} disabled={count !== 1}>
        Mention in the prompt
      </Item>
      <Item onClick={props.onDelete} tone="danger">
        {count === 1 ? 'Remove from board' : `Remove ${count} from board`}
      </Item>
    </div>
  )
}

function Item(props: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        'px-3 py-2 text-left text-sm outline-none',
        'disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent',
        props.tone === 'danger'
          ? 'text-danger hover:bg-danger/10'
          : 'text-ink hover:bg-surface-hover',
      )}
    >
      {props.children}
    </button>
  )
}
