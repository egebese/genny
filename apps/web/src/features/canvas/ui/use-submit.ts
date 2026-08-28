'use client'

import { useCallback, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { SubmitOutcome } from './use-generate.ts'
import type { VariantOutcome } from './use-variants.ts'

type Options = {
  generate: (
    model: PickableModel,
    prompt: string,
    settings: Record<string, unknown>,
    attachments: { field: string; assetId: string }[],
  ) => Promise<SubmitOutcome>
  variants: (source: CanvasNodeView) => Promise<VariantOutcome>
  onPlaced: (nodes: CanvasNodeView[]) => void
}

/**
 * Sending one generation, and what the dock shows while it is in flight.
 *
 * The prompt and its attachments survive a submit. Most of the next generation
 * is this one with a word changed, and clearing them made people redo the setup
 * every time.
 */
export function useSubmit({ generate, variants, onPlaced }: Options) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (
      model: PickableModel | null,
      prompt: string,
      settings: Record<string, unknown>,
      attachments: { field: string; assetId: string }[],
    ) => {
      // Nothing in the family can take what is attached. The dock says so and
      // disables the button; this is the guard for every other way in.
      if (!model) return

      setPending(true)
      setError(null)
      const outcome = await generate(model, prompt, settings, attachments)
      setPending(false)

      if (!outcome.ok) {
        setError(outcome.reason)
        return
      }
      setError(outcome.warning)
      onPlaced(outcome.nodes)
    },
    [generate, onPlaced],
  )

  /*
   * The same two pieces of state, because it is the same sentence: the board is
   * spending money and the dock is where that shows. An agent takes about two
   * seconds before any image starts, which is long enough that a button doing
   * nothing reads as a button that did not work.
   */
  const runVariants = useCallback(
    async (source: CanvasNodeView) => {
      setPending(true)
      setError(null)
      const made = await variants(source)
      setPending(false)

      if (!made.ok) {
        setError(made.reason)
        return
      }
      onPlaced(made.nodes)
    },
    [variants, onPlaced],
  )

  return { pending, error, setError, submit, runVariants }
}
