'use client'

import type { MediaKind } from '@genny/models/aspect.ts'
import { useCallback, useMemo, useState } from 'react'
import { defaultFamily } from '../default-model.ts'
import { type PickableFamily, taskFor, toFamilies } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import type { Attachment } from './attachment-strip.tsx'

/**
 * What is about to be generated: a model, its settings, and the prompt.
 *
 * The endpoint is not part of the state. The picker chooses the model and what
 * is attached chooses the endpoint, because fal splits one model across URLs by
 * what you hand it and nobody should have to know which URL they are on.
 */
export function useComposer(
  models: PickableModel[],
  carryAttachments: (to: PickableFamily) => void,
) {
  const families = useMemo(() => toFamilies(models), [models])
  const [family, setFamily] = useState<PickableFamily>(() => defaultFamily(families))
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [prompt, setPrompt] = useState('')

  const choose = useCallback(
    (next: PickableFamily) => {
      setFamily(next)
      // The controls are the endpoint's own, so nothing carries over. What is
      // attached does: the field names change, the intent does not.
      setSettings({})
      carryAttachments(next)
    },
    [carryAttachments],
  )

  const set = useCallback((name: string, value: unknown) => {
    setSettings((current) => ({ ...current, [name]: value }))
  }, [])

  /** The family holding a given endpoint, for reusing a past generation. */
  const familyOf = useCallback(
    (endpointId: string) =>
      families.find((candidate) =>
        candidate.variants.some((variant) => variant.endpointId === endpointId),
      ) ?? null,
    [families],
  )

  return {
    families,
    family,
    settings,
    prompt,
    choose,
    set,
    setSettings,
    setPrompt,
    familyOf,
    /** Null when nothing in the family can take what is attached. */
    resolve: (carrying: readonly MediaKind[]) => taskFor(family, carrying),
  }
}

/**
 * What this generation is carrying, one entry per item.
 *
 * Not deduplicated: the resolver counts. Two images reach a transition endpoint
 * that needs a first and a last frame, one image reaches the one that animates
 * a still, and collapsing them to "an image" sends the first case to a 422.
 */
export function kindsOf(attachments: Attachment[], mentionCount: number): MediaKind[] {
  // A mention resolves to an image today: `listMentionablesFor` only offers
  // images and characters, and a character is a bundle of them.
  return [...attachments.map((attachment) => attachment.kind), ...Array(mentionCount).fill('image')]
}
