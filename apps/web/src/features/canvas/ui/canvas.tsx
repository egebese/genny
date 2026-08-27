'use client'

import { Dock } from '@genny/ui/dock.tsx'
import { useCallback, useRef, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import { persistViewport } from '../server/actions.ts'
import type { ProjectPage } from '../server/project-page.ts'
import { Board } from './board.tsx'
import { EmptyHint } from './empty-hint.tsx'
import { JobTracker } from './job-tracker.tsx'
import { KeyGate } from './key-gate.tsx'
import { NodePanel, type ReuseRequest } from './node-panel.tsx'
import { PromptDock } from './prompt-dock.tsx'
import { useBoardNodes } from './use-board-nodes.ts'
import { useGenerate } from './use-generate.ts'
import { useSize } from './use-size.ts'
import { useViewport } from './use-viewport.ts'

export function Canvas(props: ProjectPage) {
  const surface = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectedId, setInspectedId] = useState<string | null>(null)
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
  const { nodes, running, move, commit, remove, add, settle } = useBoardNodes(
    projectId,
    props.nodes,
  )
  const board = useSize(surface)
  const dockSize = useSize(dock)

  const generate = useGenerate({
    projectId,
    nodes,
    mentionables: props.mentionables,
    centreOfView: view.centreOfView,
  })

  async function submit(text: string) {
    setPending(true)
    setError(null)
    const outcome = await generate(model, text, settings)
    setPending(false)
    if (!outcome.ok) {
      setError(outcome.reason)
      return
    }
    setError(outcome.warning)
    add(outcome.nodes)
    // The prompt stays. Most of the next one is the last one with a word
    // changed, and clearing it made the person retype what they had just typed.
  }

  function mention(label: string) {
    setPrompt((current) => (current.trimEnd() ? `${current.trimEnd()} @${label} ` : `@${label} `))
  }

  function reuse(request: ReuseRequest) {
    const found = props.models.find((candidate) => candidate.endpointId === request.modelId)
    if (found) setModel(found)
    setSettings(request.settings)
    setPrompt(request.prompt)
  }

  const inspected = nodes.find((node) => node.id === inspectedId) ?? null

  function select(id: string | null) {
    setSelectedId(id)
    // Inspecting follows the selection rather than surviving it: a panel still
    // describing the node you just clicked away from is a panel that lies.
    if (id !== inspectedId) setInspectedId(null)
  }

  function inspect(id: string) {
    setSelectedId(id)
    setInspectedId((current) => (current === id ? null : id))
  }

  return (
    <>
      {running.map((jobId) => (
        <JobTracker
          key={jobId}
          jobId={jobId as string}
          onSettled={() => void settle(jobId as string)}
        />
      ))}

      <Board
        surface={surface}
        nodes={nodes}
        selectedId={selectedId}
        viewport={view.viewport}
        panning={view.panning}
        onSelect={select}
        onInspect={inspect}
        onPan={view.startPan}
        onKey={(key) => view.handleKey(key, nodes)}
        onMove={move}
        onCommit={commit}
        onDelete={(id) => {
          remove(id)
          select(null)
        }}
        onZoom={view.zoomBy}
        onFit={() => view.fit(nodes)}
      >
        {nodes.length === 0 ? <EmptyHint /> : null}
        {inspected ? (
          <NodePanel
            node={inspected}
            viewport={view.viewport}
            // The dock is not part of the board, so the panel may not reach
            // under it: it would cover the one control the person needs next.
            bounds={{ width: board.width, height: board.height - dockSize.height }}
            onClose={() => setInspectedId(null)}
            onMention={mention}
            onReuse={reuse}
            onDelete={() => {
              remove(inspected.id)
              select(null)
            }}
          />
        ) : null}
      </Board>

      {/* pointer-events-none so the strip either side of the dock still pans the
          board. The dock's own card turns them back on. */}
      <div ref={dock} className="pointer-events-none">
        <Dock>
          {ready ? (
            <PromptDock
              models={props.models}
              model={model}
              mentionables={props.mentionables}
              onModelChange={(next) => {
                setModel(next)
                setSettings({})
              }}
              settings={settings}
              onSettingChange={(name, value) =>
                setSettings((current) => ({ ...current, [name]: value }))
              }
              pending={pending}
              error={error}
              credits={props.credits ? { enabled: true, perUsd: props.credits.perUsd } : null}
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={(text) => void submit(text)}
            />
          ) : (
            <KeyGate onReady={() => setReady(true)} />
          )}
        </Dock>
      </div>
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
  const images = models.filter((model) => model.modality === 'image')
  const preferred = images.find((model) => model.featured) ?? images[0] ?? models[0]
  return preferred as PickableModel
}
