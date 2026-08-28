'use client'

import { useCallback, useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { useGenerate } from './use-generate.ts'
import type { useVariants } from './use-variants.ts'

type Options = {
  generate: ReturnType<typeof useGenerate>
  variants: ReturnType<typeof useVariants>
  /** Puts rectangles on the board. Called before the request, not after it. */
  onPlaced: (nodes: CanvasNodeView[]) => void
  /** Swaps them for the rows the server wrote, or takes them back off. */
  onReplace: (reserved: readonly string[], real: CanvasNodeView[]) => void
}

/**
 * Spending money from the board, and what shows while it happens.
 *
 * The rectangles go down first and the request goes after. Submitting means
 * uploading every attachment to fal, which is seconds; waiting for that before
 * drawing anything left the board looking like it had ignored the button, with
 * only the word "Sending" on the button itself to say otherwise.
 *
 * The prompt and its attachments survive a submit. Most of the next generation
 * is this one with a word changed, and clearing them made people redo the setup
 * every time.
 */
export function useSubmit({ generate, variants, onPlaced, onReplace }: Options) {
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

      const held = generate.reserve(model, settings)
      onPlaced(held.nodes)
      setPending(true)
      setError(null)

      const outcome = await generate.send(model, prompt, settings, attachments, held.anchor)
      setPending(false)
      const ids = held.nodes.map((node) => node.id)

      if (!outcome.ok) {
        // Nothing ran, so nothing is shown. A rectangle for a generation that
        // never started is a promise the board cannot keep.
        onReplace(ids, [])
        setError(outcome.reason)
        return
      }
      setError(outcome.warning)
      onReplace(ids, outcome.nodes)
    },
    [generate, onPlaced, onReplace],
  )

  /*
   * The same shape, for the same reason. An agent takes about two seconds to
   * write four variant prompts before any image starts, and the count and the
   * rectangles are known from the moment the menu item is clicked.
   */
  const runVariants = useCallback(
    async (source: CanvasNodeView) => {
      const held = variants.reserve(source)
      onPlaced(held.nodes)
      setPending(true)
      setError(null)

      const made = await variants.send(source, held.rects)
      setPending(false)
      const ids = held.nodes.map((node) => node.id)

      if (!made.ok) {
        onReplace(ids, [])
        setError(made.reason)
        return
      }
      onReplace(ids, made.nodes)
    },
    [variants, onPlaced, onReplace],
  )

  return { pending, error, setError, submit, runVariants }
}
