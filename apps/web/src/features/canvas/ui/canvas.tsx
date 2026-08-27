'use client'

import { useCallback, useRef, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import { persistViewport } from '../server/actions.ts'
import type { ProjectPage } from '../server/project-page.ts'
import { Board } from './board.tsx'
import { BoardOverlays } from './board-overlays.tsx'
import { CanvasDock } from './canvas-dock.tsx'
import { EmptyHint } from './empty-hint.tsx'
import { JobTracker } from './job-tracker.tsx'
import type { ReuseRequest } from './node-panel.tsx'
import { useAttachments } from './use-attachments.ts'
import { useBoardNodes } from './use-board-nodes.ts'
import { useGenerate } from './use-generate.ts'
import { useMentionables, useResolvedMentions } from './use-mentionables.ts'
import { useSelection } from './use-selection.ts'
import { useSize } from './use-size.ts'
import { useSurfaces } from './use-surfaces.ts'
import { useViewport } from './use-viewport.ts'

export function Canvas(props: ProjectPage) {
  const surface = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const [model, setModel] = useState<PickableModel>(defaultModel(props.models))
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [prompt, setPrompt] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(props.hasCredentials)

  const projectId = props.projectId
  const savePan = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      void persistViewport({ projectId, ...viewport })
    },
    [projectId],
  )
  const view = useViewport({ initial: props.viewport, surface, onPersist: savePan })
  const handles = useMentionables(props.mentionables)
  const { nodes, running, move, commit, remove, add, settle } = useBoardNodes(
    projectId,
    props.nodes,
    handles.learn,
  )
  const mentions = useResolvedMentions(handles.resolve, prompt)
  const pick = useSelection({ nodes, viewport: view.viewport, toLocal: view.toLocal })
  const pinned = useAttachments()
  const surfaces = useSurfaces()
  const board = useSize(surface)
  const dockSize = useSize(dock)

  const generate = useGenerate({
    projectId,
    nodes,
    mentionables: handles.mentionables,
    centreOfView: view.centreOfView,
  })

  async function submit(text: string) {
    setPending(true)
    setError(null)
    const outcome = await generate(model, text, settings, pinned.forRequest())
    setPending(false)
    if (!outcome.ok) {
      setError(outcome.reason)
      return
    }
    setError(outcome.warning)
    add(outcome.nodes)
    // The prompt and its attachments stay. Most of the next generation is this
    // one with a word changed, and clearing them made people redo the setup.
  }

  function chooseModel(next: PickableModel) {
    setModel(next)
    setSettings({})
    // The fields change with the model, so a pin to `image_url` on the last one
    // means nothing here and would be sent somewhere nobody asked for.
    pinned.clear()
  }

  function mention(label: string) {
    setPrompt((current) => (current.trimEnd() ? `${current.trimEnd()} @${label} ` : `@${label} `))
  }

  function reuse(request: ReuseRequest) {
    const found = props.models.find((candidate) => candidate.endpointId === request.modelId)
    if (found) chooseModel(found)
    setSettings(request.settings)
    setPrompt(request.prompt)
  }

  function removeNodes(ids: string[]) {
    for (const id of ids) remove(id)
    pick.clear()
    surfaces.clear()
  }

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
        nodes={nodes}
        selected={pick.selected}
        marquee={pick.marquee}
        viewport={view.viewport}
        panning={view.panning}
        panMode={view.spaceHeld}
        onSelect={(id, additive) => {
          pick.select(id, additive)
          surfaces.clear()
        }}
        onInspect={surfaces.inspect}
        onContextMenu={(id, at) => {
          // Right-clicking outside the selection acts on what was clicked, the
          // way it does everywhere else, rather than on what happened to be picked.
          const chosen = pick.selected.has(id) ? [...pick.selected] : [id]
          if (!pick.selected.has(id)) pick.select(id, false)
          surfaces.openMenu(
            view.toLocal(at),
            nodes.filter((node) => chosen.includes(node.id)),
          )
        }}
        onPan={(event) => {
          surfaces.clear()
          view.startPan(event)
        }}
        onMarquee={(event, additive) => {
          surfaces.clear()
          pick.startMarquee(event, additive)
        }}
        onKey={(key) => view.handleKey(key, nodes)}
        onMove={move}
        onCommit={commit}
        onDelete={(id) => removeNodes([id])}
        onZoom={view.zoomBy}
        onFit={() => view.fit(nodes)}
      >
        {nodes.length === 0 ? <EmptyHint /> : null}

        <BoardOverlays
          menu={menu}
          inspected={inspected}
          model={model}
          models={props.models}
          showCost={props.credits !== null}
          viewport={view.viewport}
          bounds={bounds}
          onAttach={(field, chosen) => {
            pinned.attach(model, field, chosen)
            surfaces.closeMenu()
          }}
          onMention={mention}
          onReuse={reuse}
          onRemove={removeNodes}
          onCloseMenu={surfaces.closeMenu}
          onCloseInspector={surfaces.closeInspector}
        />
      </Board>

      <CanvasDock
        ref={dock}
        {...{ models: props.models, model, settings, prompt, pending, error, ready }}
        mentionables={handles.mentionables}
        mentions={mentions.chips}
        resolvable={mentions.resolvable}
        attachments={pinned.attachments}
        credits={props.credits}
        onRemoveAttachment={pinned.remove}
        onModelChange={chooseModel}
        onSettingChange={(name, value) => setSettings((c) => ({ ...c, [name]: value }))}
        onPromptChange={setPrompt}
        onSubmit={(text) => void submit(text)}
        onReady={() => setReady(true)}
      />
    </>
  )
}

/**
 * A board starts with a still: an image model, whichever is featured.
 *
 * Merging the three studios made this a real decision. Picking the first
 * featured model of any modality meant a text to speech endpoint was the
 * default, so the first prompt someone typed got read aloud.
 */
function defaultModel(models: PickableModel[]): PickableModel {
  const images = models.filter((candidate) => candidate.modality === 'image')
  return (images.find((candidate) => candidate.featured) ?? images[0] ?? models[0]) as PickableModel
}
