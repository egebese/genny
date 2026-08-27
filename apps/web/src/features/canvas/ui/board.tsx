'use client'

import type { Viewport } from '@genny/canvas/geometry.ts'
import { Button } from '@genny/ui/button.tsx'
import { cn } from '@genny/ui/cn.ts'
import type { ReactNode, RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { CanvasNode } from './canvas-node.tsx'

type BoardProps = {
  surface: RefObject<HTMLDivElement | null>
  nodes: CanvasNodeView[]
  selectedId: string | null
  viewport: Viewport
  panning: boolean
  onSelect: (id: string | null) => void
  onInspect: (id: string) => void
  onPan: (event: React.PointerEvent) => void
  onKey: (key: string) => boolean
  onMove: (id: string, position: { x: number; y: number }) => void
  onCommit: (id: string, position: { x: number; y: number }) => void
  onDelete: (id: string) => void
  onZoom: (factor: number) => void
  onFit: () => void
  children?: ReactNode
}

const GRID = 32

export function Board(props: BoardProps) {
  const { viewport } = props

  return (
    <div
      ref={props.surface}
      className={cn(
        'absolute inset-0 touch-none overflow-hidden bg-canvas',
        props.panning ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{
        // The dots ride along with the board, which is what makes panning read
        // as moving over something rather than as content sliding around.
        backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px)',
        backgroundSize: `${GRID * viewport.zoom}px ${GRID * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        props.onSelect(null)
        props.onPan(event)
      }}
    >
      <div
        role="listbox"
        aria-label="Canvas"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (props.onKey(event.key)) event.preventDefault()
        }}
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 outline-none"
      >
        {props.nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={node.id === props.selectedId}
            viewport={viewport}
            onSelect={() => props.onSelect(node.id)}
            onInspect={() => props.onInspect(node.id)}
            onMove={(position) => props.onMove(node.id, position)}
            onCommit={(position) => props.onCommit(node.id, position)}
            onDelete={() => props.onDelete(node.id)}
          />
        ))}
      </div>

      {props.children}

      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-(--radius-control) border border-line bg-surface/80 p-1 backdrop-blur">
        <Button
          type="button"
          tone="ghost"
          size="sm"
          aria-label="Zoom out"
          onClick={() => props.onZoom(1 / 1.2)}
        >
          &minus;
        </Button>
        <span className="min-w-12 text-center font-mono text-ink-muted text-xs tabular-nums">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <Button
          type="button"
          tone="ghost"
          size="sm"
          aria-label="Zoom in"
          onClick={() => props.onZoom(1.2)}
        >
          +
        </Button>
        <Button type="button" tone="ghost" size="sm" onClick={props.onFit}>
          Fit
        </Button>
      </div>
    </div>
  )
}
