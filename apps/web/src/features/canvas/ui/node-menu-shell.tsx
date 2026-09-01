'use client'

import { cn } from '@genny/ui/cn.ts'
import type React from 'react'

type Point = { x: number; y: number }

export function Shell(props: {
  menu: React.RefObject<HTMLDivElement | null>
  position: Point
  size: { width: number; height: number }
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
      style={{ left: props.position.x, top: props.position.y, width: props.size.width }}
      className="panel absolute z-30 flex flex-col overflow-y-auto overscroll-contain rounded-(--radius-panel) py-1 outline-none"
    >
      {props.children}
    </div>
  )
}

export function Item(props: {
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
        // min-h-11 is 44px: a menu item is a primary action, and on touch the
        // floor for one is the size of a thumb rather than of a pointer.
        'flex min-h-11 items-center px-3 text-left text-sm outline-none',
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
