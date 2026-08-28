'use client'

import { anchorPanel } from '@genny/canvas/anchor.ts'
import type { Point } from '@genny/canvas/geometry.ts'
import { type ReferenceSlot, slotsAccepting } from '@genny/models/slots.ts'
import { cn } from '@genny/ui/cn.ts'
import { useEffect, useRef } from 'react'
import type { PickableFamily } from '../family-list.ts'
import type { CanvasNodeView } from '../node-view.ts'

const MENU = { width: 232, height: 260 }

export type NodeMenuTarget = { at: Point; nodes: CanvasNodeView[] }

/** What the menu can do with what is on the clipboard. */
export type ClipboardActions = {
  filled: boolean
  copy: (ids: readonly string[]) => boolean
  cut: (ids: readonly string[]) => void
  paste: (at?: Point) => void
  duplicate: (ids: readonly string[]) => void
}

type NodeMenuProps = {
  target: NodeMenuTarget
  family: PickableFamily
  /** Where these could go, on the endpoint adding them would reach. */
  slotsForAdding: ReferenceSlot[]
  bounds: { width: number; height: number }
  onAttach: (field: string) => void
  onMention: () => void
  /** Absent when this node cannot be varied, so the item is simply not offered. */
  onVariants: (() => void) | null
  onDelete: () => void
  clipboard: ClipboardActions
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
  const { target, family } = props
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
  /*
   * Across the whole model, not one endpoint of it. Nano Banana 2 has no slot
   * and its edit endpoint has three, and the menu used to say "Nano Banana 2
   * takes no image" while standing on an image the model can plainly take.
   */
  /*
   * The slots of the endpoint this model will resolve to once these are added,
   * not the union across the family.
   *
   * The union offered "use as start frame" twice on PixVerse, because its
   * animator and its transition each declare one and they are different fields.
   * Asking what the model will actually run answers both at once: with nothing
   * attached it is the animator and offers one frame, with one already attached
   * it is the transition and offers two.
   */
  const slots = kind ? slotsAccepting(props.slotsForAdding, kind) : []
  const count = target.nodes.length
  const ids = target.nodes.map((node) => node.id)
  const clip = props.clipboard
  const act = (run: () => void) => () => {
    run()
    props.onClose()
  }

  const position = anchorPanel({ ...target.at, width: 0, height: 0 }, MENU, props.bounds, 8)

  /*
   * Right-clicking empty board. There is nothing to act on, so the only thing
   * worth offering is what would land there, and the browser's own menu is not
   * coming back to fill the gap.
   */
  if (count === 0) {
    return (
      <Shell menu={menu} position={position} label="Board actions">
        <Item onClick={act(() => clip.paste(target.at))} disabled={!clip.filled}>
          Paste
        </Item>
      </Shell>
    )
  }

  return (
    <Shell menu={menu} position={position} label="Result actions">
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
          {kind ? `${family.name} takes no ${kind}.` : 'Pick one kind of result at a time.'}
        </p>
      ) : null}

      <hr className="my-1 border-line" />
      <Item onClick={act(() => clip.copy(ids))}>Copy</Item>
      <Item onClick={act(() => clip.cut(ids))}>Cut</Item>
      <Item onClick={act(() => clip.duplicate(ids))}>Duplicate</Item>
      <Item onClick={act(() => clip.paste(target.at))} disabled={!clip.filled}>
        Paste
      </Item>

      <hr className="my-1 border-line" />
      {props.onVariants ? (
        <Item onClick={props.onVariants} disabled={count !== 1}>
          Make four variants
        </Item>
      ) : null}
      <Item onClick={props.onMention} disabled={count !== 1}>
        Mention in the prompt
      </Item>
      <Item onClick={props.onDelete} tone="danger">
        {count === 1 ? 'Remove from board' : `Remove ${count} from board`}
      </Item>
    </Shell>
  )
}

function Shell(props: {
  menu: React.RefObject<HTMLDivElement | null>
  position: Point
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      ref={props.menu}
      role="menu"
      data-overlay
      tabIndex={-1}
      aria-label={props.label}
      style={{ left: props.position.x, top: props.position.y, width: MENU.width }}
      className="panel absolute z-30 flex flex-col overflow-hidden rounded-(--radius-panel) py-1 outline-none"
    >
      {props.children}
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
