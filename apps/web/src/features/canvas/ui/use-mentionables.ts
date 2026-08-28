'use client'

import { mentionedLabels } from '@genny/models/mention.ts'
import { useCallback, useMemo, useState } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import type { MentionChip } from './attachment-strip.tsx'

/**
 * What `@` can currently reach, and what the prompt is currently reaching for.
 *
 * The list is seeded at page load and grows as generations land. Without that it
 * only ever held what existed when the tab opened, so the first thing you made
 * on a board could not be mentioned on the board that made it: the handle
 * resolved to nothing and the generation ran without the reference, silently.
 */
export function useMentionables(initial: MentionableView[]) {
  const [mentionables, setMentionables] = useState(initial)

  const learn = useCallback((nodes: CanvasNodeView[]) => {
    setMentionables((current) => {
      const known = new Set(current.map((item) => item.label))
      const fresh = nodes
        .filter((node) => node.assetId && node.label && !known.has(node.label))
        .flatMap((node) =>
          node.assetId && node.label && node.kind
            ? [
                {
                  id: node.assetId,
                  label: node.label,
                  kind: 'asset' as const,
                  media: node.kind,
                  previewUrl: node.kind === 'image' ? node.url : null,
                  count: 1,
                },
              ]
            : [],
        )
      return fresh.length > 0 ? [...fresh, ...current] : current
    })
  }, [])

  const resolve = useCallback(
    (prompt: string) => {
      const byLabel = new Map(mentionables.map((item) => [item.label, item]))
      const chips: MentionChip[] = mentionedLabels(prompt)
        .map((label) => byLabel.get(label))
        .filter((item) => item !== undefined)
        .map((item) => ({ label: item.label, previewUrl: item.previewUrl, count: item.count }))
      // Handles that match nothing are deliberately absent here: the highlight
      // marks them as a miss rather than letting them look like a reference.
      return { chips, resolvable: new Set(chips.map((chip) => chip.label)) }
    },
    [mentionables],
  )

  return { mentionables, learn, resolve }
}

/** Memoised at the call site, because it runs on every keystroke. */
export function useResolvedMentions(
  resolve: (prompt: string) => { chips: MentionChip[]; resolvable: Set<string> },
  prompt: string,
) {
  return useMemo(() => resolve(prompt), [resolve, prompt])
}
