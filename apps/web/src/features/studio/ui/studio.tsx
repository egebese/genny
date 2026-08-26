'use client'

import { mentionedLabels } from '@genny/models/mention.ts'
import { Button } from '@genny/ui/button.tsx'
import { Dock } from '@genny/ui/dock.tsx'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import { createGeneration } from '../server/create-generation.ts'
import { KeyGate } from './key-gate.tsx'
import { LiveResultCard } from './live-result-card.tsx'
import { PromptDock } from './prompt-dock.tsx'
import type { ResultItem } from './result-card.tsx'

type StudioProps = {
  models: PickableModel[]
  history: ResultItem[]
  /** Cursor for the next page of history, or null when there is no more. */
  historyCursor: string | null
  mentionables: MentionableView[]
  /** Null in byok mode, where the visitor spends their own fal balance. */
  credits: { balance: string; holdBalance: string; perUsd: number } | null
  hasCredentials: boolean
}

const MODEL_STORAGE_KEY = 'genny:image:model'

export function Studio({
  models,
  history,
  historyCursor,
  mentionables,
  credits,
  hasCredentials,
}: StudioProps) {
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
    const response = await fetch(`/api/jobs?before=${encodeURIComponent(cursor)}`).catch(() => null)
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {credits ? (
          <p className="mb-4 text-ink-muted text-sm">
            <span className="font-mono text-ink">{Math.floor(Number(credits.balance))}</span>{' '}
            credits
            {Number(credits.holdBalance) > 0 ? (
              <span className="text-ink-faint">
                {' '}
                · {Math.ceil(Number(credits.holdBalance))} reserved
              </span>
            ) : null}
          </p>
        ) : null}

        {results.length === 0 ? (
          <p className="py-20 text-center text-ink-faint">
            Nothing generated yet. Write a prompt below.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <LiveResultCard
                key={item.jobId}
                item={item}
                onMention={(label) =>
                  setPrompt((current) =>
                    current.trimEnd() ? `${current.trimEnd()} @${label} ` : `@${label} `,
                  )
                }
              />
            ))}
          </ul>
        )}

        {cursor ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              tone="neutral"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Loading' : 'Load older'}
            </Button>
          </div>
        ) : null}
      </main>

      <Dock>
        {ready ? (
          <PromptDock
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
