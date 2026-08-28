'use client'

import type { Guide } from '@genny/canvas/snap.ts'
import { useCallback, useRef, useState } from 'react'
import { persistViewport } from '../server/actions.ts'
import type { CanvasPage } from '../server/canvas-page.ts'
import { Board } from './board.tsx'
import { BoardOverlays } from './board-overlays.tsx'
import { BrandShelf } from './brand-shelf.tsx'
import { CanvasDock } from './canvas-dock.tsx'
import { EmptyHint } from './empty-hint.tsx'
import { JobTracker } from './job-tracker.tsx'
import { useAttachments } from './use-attachments.ts'
import { useBoardActions } from './use-board-actions.ts'
import { useBoardNodes } from './use-board-nodes.ts'
import { kindsOf, useComposer } from './use-composer.ts'
import { useDirector } from './use-director.ts'
import { useGenerate } from './use-generate.ts'
import { useMentionables, useResolvedMentions } from './use-mentionables.ts'
import { overlaySlots } from './use-overlay-slots.ts'
import { useSelection } from './use-selection.ts'
import { useSize } from './use-size.ts'
import { useSubmit } from './use-submit.ts'
import { useSurfaces } from './use-surfaces.ts'
import { useVariants } from './use-variants.ts'
import { useViewport } from './use-viewport.ts'

export function Canvas(props: CanvasPage) {
  const surface = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(props.hasCredentials)
  const [guides, setGuides] = useState<Guide[]>([])

  const canvasId = props.canvasId
  const savePan = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      void persistViewport({ canvasId, ...viewport })
    },
    [canvasId],
  )
  const view = useViewport({
    initial: props.viewport,
    surface,
    dock,
    layer,
    readout,
    onPersist: savePan,
  })
  const handles = useMentionables(props.mentionables)
  const { nodes, running, beginDrag, move, commit, size, sized, remove, add, replace, settle } =
    useBoardNodes(canvasId, props.nodes, handles.learn)
  const pinned = useAttachments()
  const composer = useComposer(props.models, pinned.moveTo)
  const { families, family, settings, prompt } = composer
  const mentions = useResolvedMentions(handles.resolve, prompt)
  const pick = useSelection({ nodes, viewport: view.viewport, toLocal: view.toLocal })
  const surfaces = useSurfaces()
  const board = useSize(surface)
  const dockSize = useSize(dock)

  /*
   * The picker chooses the model; what is attached chooses the endpoint. Nano
   * Banana 2 with an image on it is Nano Banana 2's edit endpoint, and nobody
   * should have to know that the URL is different.
   */
  const carrying = kindsOf(pinned.attachments, mentions.chips.length)
  const model = composer.resolve(carrying)

  const generate = useGenerate({
    canvasId,
    nodes,
    mentionables: handles.mentionables,
    visibleRect: view.visibleRect,
  })
  const variants = useVariants(canvasId, nodes, view.visibleRect)
  const director = useDirector(canvasId)
  const [directing, setDirecting] = useState(false)
  const { pending, error, submit, runVariants } = useSubmit({
    generate,
    variants,
    onPlaced: add,
    onReveal: view.reveal,
    onReplace: replace,
  })

  const act = useBoardActions({
    family,
    nodes,
    pick,
    view,
    surfaces,
    pinned,
    composer,
    beginDrag,
    remove,
  })

  const inspected = nodes.find((node) => node.id === surfaces.inspectedId) ?? null
  const menu = surfaces.menu
  const bounds = { width: board.width, height: board.height - dockSize.height }

  return (
    <>
      {running.map((jobId) => (
        <JobTracker key={jobId} jobId={jobId} onSettled={() => void settle(jobId)} />
      ))}

      <Board
        surface={surface}
        layer={layer}
        view={view.current}
        readout={readout}
        nodes={nodes}
        selected={pick.selected}
        marquee={pick.marquee}
        guides={guides}
        viewport={view.viewport}
        panning={view.panning}
        panMode={view.spaceHeld}
        onSelect={act.select}
        onInspect={surfaces.inspect}
        onContextMenu={act.openMenu}
        onPan={act.pan}
        onMarquee={act.marquee}
        onKey={(key) => view.handleKey(key, nodes)}
        onDragStart={act.startDrag}
        onMove={move}
        onGuides={setGuides}
        onCommit={commit}
        onResize={size}
        onResizeCommit={sized}
        onDelete={(id) => act.removeNodes([id])}
        onZoom={view.zoomBy}
        onFit={() => view.fit(nodes)}
      >
        {nodes.length === 0 ? <EmptyHint /> : null}

        <BrandShelf
          projectId={props.projectId}
          projectTitle={props.projectTitle}
          items={props.brandKit}
          palette={props.palette}
          onAttach={(item) => act.attachMedia(item, carrying)}
        />

        <BoardOverlays
          menu={menu}
          inspected={inspected}
          family={family}
          slotsForAdding={overlaySlots(family, carrying, menu?.nodes ?? [])}
          models={props.models}
          showCost={props.credits !== null}
          viewport={view.viewport}
          bounds={bounds}
          onAttach={act.attachAndClose}
          onMention={act.mention}
          onVariants={(node) => {
            surfaces.closeMenu()
            void runVariants(node)
          }}
          onReuse={act.reuse}
          onRemove={act.removeNodes}
          onCloseMenu={surfaces.closeMenu}
          onCloseInspector={surfaces.closeInspector}
        />
      </Board>

      <CanvasDock
        ref={dock}
        {...{ families, family, model, settings, prompt, pending, error, ready }}
        mentionables={handles.mentionables}
        mentions={mentions.chips}
        resolvable={mentions.resolvable}
        attachments={pinned.attachments}
        credits={props.credits}
        onRemoveAttachment={pinned.remove}
        onModelChange={composer.choose}
        onSettingChange={composer.set}
        onPromptChange={composer.setPrompt}
        onSubmit={(text) => void submit(model, text, settings, pinned.forRequest())}
        director={{
          on: directing,
          onToggle: () => setDirecting((was) => !was),
          turns: director.turns,
          asking: director.asking,
          error: director.error,
          // What is picked is part of the question: three shots selected and
          // "what is wrong with these" has to mean those three.
          onAsk: (question) => void director.ask(question, [...pick.selected]),
          onClear: director.clear,
        }}
        onReady={() => setReady(true)}
      />
    </>
  )
}
