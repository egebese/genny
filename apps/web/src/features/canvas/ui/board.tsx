'use client'

import type { Rect, Viewport } from '@genny/canvas/geometry.ts'
import type { Guide } from '@genny/canvas/snap.ts'
import { Button } from '@genny/ui/button.tsx'
import { cn } from '@genny/ui/cn.ts'
import type { ReactNode, RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { CanvasNode } from './canvas-node.tsx'

type BoardProps = {
  surface: RefObject<HTMLDivElement | null>
  nodes: CanvasNodeView[]
  selected: ReadonlySet<string>
  marquee: Rect | null
  /** Alignment lines, while something is being dragged. */
  guides: Guide[]
  viewport: Viewport
  panning: boolean
  /** True while space is down, which is when a drag pans instead of selecting. */
  panMode: boolean
  onSelect: (id: string, additive: boolean) => void
  onInspect: (id: string) => void
  onContextMenu: (id: string, at: { clientX: number; clientY: number }) => void
  onPan: (event: React.PointerEvent) => void
  onMarquee: (event: React.PointerEvent, additive: boolean) => void
  onKey: (key: string) => boolean
  onMove: (id: string, position: { x: number; y: number }) => void
  onGuides: (guides: Guide[]) => void
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
        props.panning ? 'cursor-grabbing' : props.panMode ? 'cursor-grab' : 'cursor-default',
      )}
      style={{
        // The dots ride along with the board, which is what makes panning read
        // as moving over something rather than as content sliding around.
        backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px)',
        backgroundSize: `${GRID * viewport.zoom}px ${GRID * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={(event) => {
        /*
         * The transform layer covers the whole surface, so a click on empty board
         * lands on it rather than here. Asking what was actually hit is the only
         * test that means what it looks like it means.
         *
         * The overlays matter as much as the nodes: they render inside the
         * surface, so without this a press on a menu item clears the surfaces and
         * unmounts the button before its click can land.
         */
        if ((event.target as HTMLElement).closest('[role="option"], [data-overlay]')) return
        // Space, or the middle button, pans. Everything else draws a band.
        if (props.panMode || event.button === 1) props.onPan(event)
        else props.onMarquee(event, event.shiftKey || event.metaKey)
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
        {/* Under the nodes, in canvas space, so a line stays on its edge at any
            zoom. Its own width is divided back out so it stays hairline. */}
        {props.guides.map((guide) => (
          <div
            key={`${guide.axis}:${guide.at}:${guide.from}`}
            aria-hidden
            style={
              guide.axis === 'x'
                ? {
                    left: guide.at,
                    top: guide.from,
                    height: guide.to - guide.from,
                    width: 1 / viewport.zoom,
                  }
                : {
                    top: guide.at,
                    left: guide.from,
                    width: guide.to - guide.from,
                    height: 1 / viewport.zoom,
                  }
            }
            className="pointer-events-none absolute bg-accent"
          />
        ))}

        {props.nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={props.selected.has(node.id)}
            viewport={viewport}
            panMode={props.panMode}
            onSelect={(additive) => props.onSelect(node.id, additive)}
            onInspect={() => props.onInspect(node.id)}
            onContextMenu={(at) => props.onContextMenu(node.id, at)}
            neighbours={props.nodes.filter((other) => other.id !== node.id)}
            onMove={(position) => props.onMove(node.id, position)}
            onGuides={props.onGuides}
            onCommit={(position) => props.onCommit(node.id, position)}
            onDelete={() => props.onDelete(node.id)}
          />
        ))}
      </div>

      {props.marquee ? (
        <div
          aria-hidden
          style={{
            left: props.marquee.x,
            top: props.marquee.y,
            width: props.marquee.width,
            height: props.marquee.height,
          }}
          className="pointer-events-none absolute border border-accent bg-accent/10"
        />
      ) : null}

      {props.children}

      <div className="panel pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-(--radius-panel) p-1">
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
