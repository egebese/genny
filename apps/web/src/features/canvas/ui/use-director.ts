'use client'

import { useCallback, useState } from 'react'
import { askDirector } from '../server/ask-director.ts'

export type Turn = {
  /** What was asked, and what came back. Kept together so a reply has a question. */
  question: string
  reply: string
  shots: { prompt: string; title: string }[]
}

/**
 * The conversation, for as long as the tab is open.
 *
 * Deliberately not persisted. The director is told the brief, what the boards
 * have turned out to be about, and what is on this one, all of which the studio
 * already records and all of which is more durable than a chat log. Keeping the
 * transcript too would be a second, worse memory that drifts from the first.
 *
 * Only the last exchange is shown, so this holds a short tail rather than
 * everything: what is not on screen is not being read.
 */
const KEEP = 6

export function useDirector(canvasId: string) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = useCallback(
    async (question: string, selected: readonly string[]) => {
      setAsking(true)
      setError(null)
      const answered = await askDirector({ canvasId, question, selected: [...selected] })
      setAsking(false)

      if (!answered.ok) {
        setError(answered.reason)
        return
      }
      setTurns((current) =>
        [...current, { question, reply: answered.reply, shots: answered.shots }].slice(-KEEP),
      )
    },
    [canvasId],
  )

  const clear = useCallback(() => {
    setTurns([])
    setError(null)
  }, [])

  return { turns, asking, error, ask, clear }
}
