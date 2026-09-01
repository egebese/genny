'use client'

import type { Rect, Viewport } from '@genny/canvas/geometry.ts'
import type { Guide } from '@genny/canvas/snap.ts'
import { cn } from '@genny/ui/cn.ts'
import type { ReactNode, RefObject } from 'react'
import type { CanvasNodeView } from '../node-view.ts'
import { CanvasNode } from './canvas-node.tsx'
import { SnapGuides } from './snap-guides.tsx'
import { ZoomControl } from './zoom-control.tsx'

type BoardProps = {
  surface: RefObject<HTMLDivElement | null>
  /** The transformed layer, moved directly while a gesture runs. */
  layer: RefObject<HTMLDivElement | null>
  /** The live viewport, so a zoom does not re-render every node. */
  view: RefObject<Viewport>
  /** The zoom percentage, written rather than rendered. */
  readout: RefObject<HTMLSpanElement | null>
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
  /** Right-click on empty board, where the only thing to offer is a paste. */
  onBoardMenu: (at: { clientX: number; clientY: number }) => void
  onPan: (event: React.PointerEvent) => void
  onMarquee: (event: React.PointerEvent, additive: boolean) => void
  onKey: (key: string) => boolean
  onDragStart: (id: string) => void
  onMove: (id: string, position: { x: number; y: number }) => void
  onGuides: (guides: Guide[]) => void
  onCommit: (id: string, position: { x: number; y: number }) => void
  /** Live while the corner is dragged, and again on release, which is written. */
  onResize: (id: string, size: { width: number; height: number }) => void
  onResizeCommit: (id: string, size: { width: number; height: number }) => void
  onDelete: (id: string) => void
  onZoom: (factor: number) => void
  onFit: () => void
  children?: ReactNode
}

export function Board(props: BoardProps) {
  const { viewport } = props

  return (
    <div
      ref={props.surface}
      className={cn(
        'absolute inset-0 touch-none overflow-hidden bg-canvas',
        props.panning ? 'cursor-grabbing' : props.panMode ? 'cursor-grab' : 'cursor-default',
      )}
      /*
       * The dots ride along with the board, which is what makes panning read as
       * moving over something rather than as content sliding around. Their size
       * and offset are written by the viewport, alongside the transform, so
       * they keep up during a gesture that deliberately re-renders nothing.
       */
      style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px)' }}
      onPointerDown={(event) => {
        if (hitSomething(event.target)) return
        // Space, or the middle button, pans. Everything else draws a band.
        if (props.panMode || event.button === 1) props.onPan(event)
        else props.onMarquee(event, event.shiftKey || event.metaKey)
      }}
    >
      {/*
        The transform is written here by `useViewport`, not rendered from state.
        A pinch is one CSS transform on this element and sixty React renders of
        everything inside it, and only the first of those is the zoom.
      */}
      <div
        ref={props.layer}
        role="listbox"
        aria-label="Canvas"
        tabIndex={-1}
        onKeyDown={(event) => {
          /*
           * Only keys aimed at the board itself.
           *
           * The arrows pan and were taken here whatever they were pressed on,
           * so an arrow on a focused scrubber inside a node panned the board
           * instead of moving through the sound, and the node's own nudge keys
           * were reached only because they were prevented after the fact. A
           * control inside the board keeps its own keys.
           */
          if (event.target !== event.currentTarget) return
          if (props.onKey(event.key)) event.preventDefault()
        }}
        // A node's own handler runs first and this one still sees the event, so
        // one question decides which of the two menus opens. The overlays are
        // outside this layer, so a right-click on one never arrives here at all.
        onContextMenu={(event) => {
          if (hitSomething(event.target)) return
          event.preventDefault()
          props.onBoardMenu(event)
        }}
        style={{ transformOrigin: '0 0' }}
        className="absolute inset-0 outline-none"
      >
        <SnapGuides guides={props.guides} zoom={viewport.zoom} />

        {props.nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            zoom={viewport.zoom}
            selected={props.selected.has(node.id)}
            panMode={props.panMode}
            onSelect={(additive) => props.onSelect(node.id, additive)}
            onDragStart={() => props.onDragStart(node.id)}
            onInspect={() => props.onInspect(node.id)}
            onContextMenu={(at) => props.onContextMenu(node.id, at)}
            /*
             * Asked for when a drag starts, not built on every render.
             *
             * Every node was handed its own filtered copy of the board, which
             * is a pass over every node for every node on every render, and a
             * pinch renders. Ninety results made that eight thousand
             * comparisons and ninety arrays, sixty times a second, to answer a
             * question only the node being dragged ever asks.
             *
             * The answer is the same either way: everything not moving.
             * Snapping a dragged node against another node moving with it would
             * line it up on a line that is itself sliding, which reads as the
             * guide chasing the pointer.
             */
            view={props.view}
            neighbours={() =>
              props.nodes.filter(
                (other) =>
                  other.id !== node.id &&
                  !(props.selected.has(node.id) && props.selected.has(other.id)),
              )
            }
            onMove={(position) => props.onMove(node.id, position)}
            onGuides={props.onGuides}
            onCommit={(position) => props.onCommit(node.id, position)}
            onResize={(size) => props.onResize(node.id, size)}
            onResizeCommit={(size) => props.onResizeCommit(node.id, size)}
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

      <ZoomControl
        zoom={viewport.zoom}
        readout={props.readout}
        onZoom={props.onZoom}
        onFit={props.onFit}
      />
    </div>
  )
}

/**
 * A node or an overlay, as opposed to the bare board.
 *
 * The transform layer covers the whole surface, so a press on empty board lands
 * on it rather than on the surface, and asking what was actually hit is the only
 * test that means what it looks like it means.
 *
 * The overlays matter as much as the nodes: they render inside the surface, so
 * without this a press on a menu item clears the surfaces and unmounts the
 * button before its click can land.
 */
function hitSomething(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="option"], [data-overlay]') !== null
}
