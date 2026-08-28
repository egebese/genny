'use client'

import { placeInFlow } from '@genny/canvas/flow.ts'
import type { Rect } from '@genny/canvas/geometry.ts'
import { nodeSize, rowFootprint, siblingRects } from '@genny/canvas/placement.ts'
import { outputAspect, outputCount } from '@genny/models/aspect.ts'
import { mentionedLabels } from '@genny/models/mention.ts'
import { useCallback } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { reservedNode } from '../reserved.ts'
import { createGeneration } from '../server/create-generation.ts'

type Options = {
  canvasId: string
  nodes: CanvasNodeView[]
  mentionables: MentionableView[]
  visibleRect: () => Rect
}

export type SubmitOutcome =
  | { ok: true; nodes: CanvasNodeView[]; warning: string | null }
  | { ok: false; reason: string }

/** Rectangles held on the board while the request is in flight. */
export type Reservation = { anchor: Rect; nodes: CanvasNodeView[] }

/**
 * Turns a prompt into reserved rectangles and a running job.
 *
 * In two halves on purpose. `reserve` is synchronous and puts the boxes on the
 * board the moment the button is pressed; `send` is the round trip. They used
 * to be one call, so nothing appeared until the server answered and the only
 * sign anything was happening was the word "Sending" on a button. Submitting a
 * generation involves uploading every attachment to fal, which is seconds of a
 * board that looks like it ignored you.
 *
 * The rectangles are worked out here, on the client, because only the browser
 * knows where the person is looking and what is already placed. The server
 * takes the coordinates as given and only checks they are sane.
 */
export function useGenerate({ canvasId, nodes, mentionables, visibleRect }: Options) {
  /*
   * Room for every output, found before the first one exists. A request for
   * four that reserves one rectangle drops the other three wherever the layout
   * has space by then, which is on top of whatever the person put there.
   */
  const reserve = useCallback(
    (model: PickableModel, settings: Record<string, unknown>): Reservation => {
      const size = nodeSize(outputAspect(model.modality, settings))
      const count = outputCount(settings)
      const footprint = rowFootprint(size, count)
      const anchor = {
        ...placeInFlow({ taken: nodes, view: visibleRect(), size: footprint }),
        ...size,
      }

      return { anchor, nodes: siblingRects(anchor, count).map(reservedNode) }
    },
    [nodes, visibleRect],
  )

  const send = useCallback(
    async (
      model: PickableModel,
      prompt: string,
      settings: Record<string, unknown>,
      attachments: { field: string; assetId: string }[],
      anchor: Rect,
    ): Promise<SubmitOutcome> => {
      /*
       * References come out of the prompt text rather than a parallel list.
       * Deleting a mention then deletes its reference, which is what the person
       * clearly meant, and there is no second source of truth to drift.
       */
      const byLabel = new Map(mentionables.map((item) => [item.label, item]))
      const references = mentionedLabels(prompt)
        .map((label) => byLabel.get(label))
        .filter((item): item is MentionableView => item !== undefined)
        .map((item) => ({
          token: `@${item.label}`,
          label: item.label,
          kind: item.kind,
          id: item.id,
        }))

      const result = await createGeneration({
        canvasId,
        modelId: model.endpointId,
        prompt,
        settings,
        references,
        attachments,
        node: anchor,
      })
      if (!result.ok) return { ok: false, reason: result.reason }

      /*
       * The server decides how many, from the validated payload, so its ids are
       * the truth. Falling back to the local count keeps the board honest if it
       * answered with none.
       */
      const rects = siblingRects(anchor, Math.max(result.nodeIds.length, 1))

      return {
        ok: true,
        nodes: rects.map((rect, index) => ({
          ...reservedNode(rect),
          id: result.nodeIds[index] ?? `${result.jobId}:${index}`,
          jobId: result.jobId,
        })),
        // Not an error: the generation is running, it just could not take every
        // reference. Saying so beats silently ignoring half the input.
        warning: result.dropped?.length
          ? `${model.displayName} could not take ${result.dropped.map((l) => `@${l}`).join(', ')}.`
          : null,
      }
    },
    [canvasId, mentionables],
  )

  return { reserve, send }
}
