'use client'

import { useState } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { useDirector } from './use-director.ts'
import { useGenerate } from './use-generate.ts'
import { useSubmit } from './use-submit.ts'
import { useVariants } from './use-variants.ts'

type Rect = { x: number; y: number; width: number; height: number }

type Options = {
  canvasId: string
  nodes: CanvasNodeView[]
  mentionables: MentionableView[]
  visibleRect: () => Rect
  reveal: (rect: Rect) => void
  onPlaced: (nodes: CanvasNodeView[]) => void
  onReplace: (reserved: readonly string[], real: CanvasNodeView[]) => void
}

/**
 * Everything about asking for a generation, in one place.
 *
 * Four hooks that only ever appear together, plus the director's open/closed
 * flag. They were inline in `Canvas`, which is a component that also owns the
 * viewport, the selection, the surfaces and the dock, and the file had run out
 * of room. Nothing here changed on the way out.
 */
export function useCanvasGeneration(options: Options) {
  const generate = useGenerate({
    canvasId: options.canvasId,
    nodes: options.nodes,
    mentionables: options.mentionables,
    visibleRect: options.visibleRect,
  })
  const variants = useVariants(options.canvasId, options.nodes, options.visibleRect)
  const director = useDirector(options.canvasId)
  const [directing, setDirecting] = useState(false)

  const { pending, error, submit, runVariants } = useSubmit({
    generate,
    variants,
    onPlaced: options.onPlaced,
    onReveal: options.reveal,
    onReplace: options.onReplace,
  })

  return { pending, error, submit, runVariants, director, directing, setDirecting }
}
