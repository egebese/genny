'use client'

import { mentionedLabels } from '@genny/models/mention.ts'
import { Dock } from '@genny/ui/dock.tsx'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import { createGeneration } from '../server/create-generation.ts'
import { KeyGate } from './key-gate.tsx'
import { PromptDock } from './prompt-dock.tsx'
import type { ResultItem } from './result-card.tsx'
import { ResultFeed } from './result-feed.tsx'

type StudioProps = {
  modality: 'image' | 'video' | 'audio'
  models: PickableModel[]
  history: ResultItem[]
  /** Cursor for the next page of history, or null when there is no more. */
  historyCursor: string | null
  mentionables: MentionableView[]
  /** Null in byok mode, where the visitor spends their own fal balance. */
  credits: { balance: string; holdBalance: string; perUsd: number } | null
  hasCredentials: boolean
}

export function Studio({
  modality,
  models,
  history,
  historyCursor,
  mentionables,
  credits,
  hasCredentials,
}: StudioProps) {
  // Per modality: the model you last used for video is not a candidate for audio,
  // and one shared key would have each studio forgetting the others' choice.
  const modelStorageKey = `genny:${modality}:model`

  const [ready, setReady] = useState(hasCredentials)
  const [model, setModel] = useState<PickableModel>(
    (models.find((candidate) => candidate.featured) ?? models[0]) as PickableModel,
  )
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState<ResultItem[]>(history)
  const [cursor, setCursor] = useState(historyCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Restore the last model after mount rather than during render: reading
  // localStorage on the server is impossible and guessing causes a hydration
  // mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(modelStorageKey)
    const found = models.find((candidate) => candidate.endpointId === stored)
    if (found) setModel(found)
  }, [models, modelStorageKey])

  const chooseModel = useCallback(
    (next: PickableModel) => {
      setModel(next)
      setSettings({})
      window.localStorage.setItem(modelStorageKey, next.endpointId)
    },
    [modelStorageKey],
  )

  function generate(prompt: string) {
    setError(null)

    /*
     * References are derived from the prompt text rather than tracked in state.
     * Deleting a mention then deletes its reference, which is what the person
     * clearly meant, and there is no second source of truth to drift.
     */
    const byLabel = new Map(mentionables.map((item) => [item.label, item]))
    const references = mentionedLabels(prompt)
      .map((label) => byLabel.get(label))
      .filter((item): item is MentionableView => item !== undefined)
      .map((item) => ({ token: `@${item.label}`, label: item.label, kind: item.kind, id: item.id }))

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
          assetLabels: [],
        },
        ...current,
      ])
      setPrompt('')
    })
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    const response = await fetch(
      `/api/jobs?modality=${modality}&before=${encodeURIComponent(cursor)}`,
    ).catch(() => null)
    const page = (await response?.json().catch(() => null)) as {
      items: ResultItem[]
      nextCursor: string | null
    } | null
    setLoadingMore(false)
    if (!page) return
    setResults((current) => [...current, ...page.items])
    setCursor(page.nextCursor)
  }

  return (
    <>
      <ResultFeed
        modality={modality}
        onSuggest={setPrompt}
        results={results}
        cursor={cursor}
        loadingMore={loadingMore}
        onLoadMore={() => void loadMore()}
        onMention={(label) =>
          setPrompt((current) =>
            current.trimEnd() ? `${current.trimEnd()} @${label} ` : `@${label} `,
          )
        }
      />

      <Dock>
        {ready ? (
          <PromptDock
            modality={modality}
            models={models}
            model={model}
            mentionables={mentionables}
            onModelChange={chooseModel}
            settings={settings}
            onSettingChange={(name, value) =>
              setSettings((current) => ({ ...current, [name]: value }))
            }
            pending={pending}
            error={error}
            credits={credits ? { enabled: true, perUsd: credits.perUsd } : null}
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={generate}
          />
        ) : (
          <KeyGate onReady={() => setReady(true)} />
        )}
      </Dock>
    </>
  )
}
