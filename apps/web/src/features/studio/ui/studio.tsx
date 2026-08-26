'use client'

import { mentionedLabels } from '@genny/models/mention.ts'
import { Dock } from '@genny/ui/dock.tsx'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { AssetView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import { createGeneration } from '../server/create-generation.ts'
import { KeyGate } from './key-gate.tsx'
import { LiveResultCard } from './live-result-card.tsx'
import { PromptDock } from './prompt-dock.tsx'
import type { ResultItem } from './result-card.tsx'

type StudioProps = {
  models: PickableModel[]
  history: ResultItem[]
  assets: AssetView[]
  hasCredentials: boolean
}

const MODEL_STORAGE_KEY = 'genny:image:model'

export function Studio({ models, history, assets, hasCredentials }: StudioProps) {
  const [ready, setReady] = useState(hasCredentials)
  const [model, setModel] = useState<PickableModel>(models[0] as PickableModel)
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [results, setResults] = useState<ResultItem[]>(history)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Restore the last model after mount rather than during render: reading
  // localStorage on the server is impossible and guessing causes a hydration
  // mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY)
    const found = models.find((candidate) => candidate.endpointId === stored)
    if (found) setModel(found)
  }, [models])

  const chooseModel = useCallback((next: PickableModel) => {
    setModel(next)
    setSettings({})
    window.localStorage.setItem(MODEL_STORAGE_KEY, next.endpointId)
  }, [])

  function generate(prompt: string) {
    setError(null)

    /*
     * References are derived from the prompt text rather than tracked in state.
     * Deleting a mention then deletes its reference, which is what the person
     * clearly meant, and there is no second source of truth to drift.
     */
    const byLabel = new Map(assets.map((asset) => [asset.label, asset]))
    const references = mentionedLabels(prompt)
      .map((label) => byLabel.get(label))
      .filter((asset): asset is AssetView => asset !== undefined)
      .map((asset) => ({
        token: `@${asset.label}`,
        label: asset.label,
        kind: 'asset' as const,
        id: asset.id,
      }))

    startTransition(async () => {
      const result = await createGeneration({
        modelId: model.endpointId,
        prompt,
        settings,
        references,
      })
      if (!result.ok) {
        setError(result.reason)
        return
      }
      if (result.dropped && result.dropped.length > 0) {
        // Not an error: the generation is running, it just could not take every
        // reference. Saying so beats silently ignoring half the input.
        setError(
          `${model.displayName} could not take ${result.dropped.map((l) => `@${l}`).join(', ')}.`,
        )
      }
      setResults((current) => [
        {
          jobId: result.jobId,
          prompt,
          modelName: model.displayName,
          status: 'queued',
          urls: [],
          error: null,
        },
        ...current,
      ])
    })
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {results.length === 0 ? (
          <p className="py-20 text-center text-ink-faint">
            Nothing generated yet. Write a prompt below.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <LiveResultCard key={item.jobId} item={item} />
            ))}
          </ul>
        )}
      </main>

      <Dock>
        {ready ? (
          <PromptDock
            models={models}
            model={model}
            assets={assets}
            onModelChange={chooseModel}
            settings={settings}
            onSettingChange={(name, value) =>
              setSettings((current) => ({ ...current, [name]: value }))
            }
            pending={pending}
            error={error}
            onSubmit={generate}
          />
        ) : (
          <KeyGate onReady={() => setReady(true)} />
        )}
      </Dock>
    </>
  )
}
