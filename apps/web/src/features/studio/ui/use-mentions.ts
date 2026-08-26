'use client'

import { type ActiveMention, applyMention, findActiveMention } from '@genny/models/mention.ts'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { AssetView } from '@/features/assets/server/list.ts'

export type MentionState = {
  /** The mention being typed, or null when the list should be closed. */
  active: ActiveMention | null
  candidates: AssetView[]
  highlighted: number
  /** Handles the keys the list owns. Returns true when it consumed the event. */
  handleKey: (key: string) => boolean
  /** Called on every change of the textarea's value or caret. */
  sync: (text: string, caret: number) => void
  choose: (asset: AssetView) => void
  close: () => void
}

type Options = {
  assets: AssetView[]
  text: string
  onReplace: (next: { text: string; caret: number }, asset: AssetView) => void
}

const MAX_CANDIDATES = 8

/**
 * Drives an inline mention list from a plain textarea.
 *
 * The list never takes focus. That is the whole point: focus moving into a
 * popover is what makes most mention inputs impossible to type through, so this
 * one leaves the caret alone and only interprets keys the list owns.
 */
export function useMentions({ assets, text, onReplace }: Options): MentionState {
  const [active, setActive] = useState<ActiveMention | null>(null)
  const [highlighted, setHighlighted] = useState(0)
  /*
   * Where a mention was dismissed. Without this, Escape closes the list and the
   * textarea's very next selection event reopens it, because the caret is still
   * inside the same `@word`.
   *
   * A ref, not state: the selection event arrives in the same turn as the key
   * event, before a re-render, so a state value would still be the old one in
   * that closure and the list would reopen anyway.
   */
  const dismissedAt = useRef<number | null>(null)

  const candidates = useMemo(() => {
    if (!active) return []
    const query = active.query.toLowerCase()
    return assets
      .filter((asset) => asset.label.toLowerCase().includes(query))
      .slice(0, MAX_CANDIDATES)
  }, [active, assets])

  const sync = useCallback((nextText: string, caret: number) => {
    const found = findActiveMention(nextText, caret)
    if (found && found.start === dismissedAt.current) {
      setActive(null)
      return
    }
    dismissedAt.current = null
    setActive(found)
    setHighlighted(0)
  }, [])

  const close = useCallback(() => {
    setActive((current) => {
      dismissedAt.current = current?.start ?? null
      return null
    })
  }, [])

  const choose = useCallback(
    (asset: AssetView) => {
      if (!active) return
      onReplace(applyMention(text, active, asset.label), asset)
      dismissedAt.current = null
      setActive(null)
    },
    [active, onReplace, text],
  )

  const move = useCallback(
    (step: number) =>
      setHighlighted((current) => (current + step + candidates.length) % candidates.length),
    [candidates.length],
  )

  const dismiss = useCallback((at: number) => {
    // Closes the list and keeps the text: the mention may have been intended.
    dismissedAt.current = at
    setActive(null)
  }, [])

  const handleKey = useCallback(
    (key: string) => {
      if (!active || candidates.length === 0) return false

      const actions: Record<string, () => void> = {
        ArrowDown: () => move(1),
        ArrowUp: () => move(-1),
        Enter: () => {
          const picked = candidates[highlighted]
          if (picked) choose(picked)
        },
        Tab: () => {
          const picked = candidates[highlighted]
          if (picked) choose(picked)
        },
        Escape: () => dismiss(active.start),
      }

      const action = actions[key]
      if (!action) return false
      action()
      return true
    },
    [active, candidates, choose, dismiss, highlighted, move],
  )

  return { active, candidates, highlighted, handleKey, sync, choose, close }
}
