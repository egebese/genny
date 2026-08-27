'use client'

import type { Point } from '@genny/canvas/geometry.ts'
import { nodeSize, placeFree, rowFootprint, siblingRects } from '@genny/canvas/placement.ts'
import { outputAspect, outputCount } from '@genny/models/aspect.ts'
import { mentionedLabels } from '@genny/models/mention.ts'
import { useCallback } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import type { CanvasNodeView } from '../node-view.ts'
import { createGeneration } from '../server/create-generation.ts'

type Options = {
  projectId: string
  nodes: CanvasNodeView[]
  mentionables: MentionableView[]
  centreOfView: () => Point
}

export type SubmitOutcome =
  | { ok: true; nodes: CanvasNodeView[]; warning: string | null }
  | { ok: false; reason: string }

/**
 * Turns a prompt into a reserved rectangle and a running job.
 *
 * The rectangle is worked out here, on the client, because only the browser
 * knows where the person is looking and what is already on the board. The server
 * takes the coordinates as given and only checks they are sane.
 */
export function useGenerate({ projectId, nodes, mentionables, centreOfView }: Options) {
  return useCallback(
    async (
      model: PickableModel,
      prompt: string,
      settings: Record<string, unknown>,
      attachments: { field: string; assetId: string }[],
    ) => {
      /*
       * Room for every output, found before the first one exists. A request for
       * four that reserves one rectangle drops the other three wherever the
       * layout has space by then, which is on top of whatever the person put
       * there.
       */
      const size = nodeSize(outputAspect(model.modality, settings))
      const count = outputCount(settings)
      const footprint = rowFootprint(size, count)
      const centre = centreOfView()
      const anchor = {
        ...placeFree(
          nodes,
          {
            x: Math.round(centre.x - footprint.width / 2),
            y: Math.round(centre.y - footprint.height / 2),
          },
          footprint,
        ),
        ...size,
      }

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
        projectId,
        modelId: model.endpointId,
        prompt,
        settings,
        references,
        attachments,
        node: anchor,
      })
      if (!result.ok) return { ok: false, reason: result.reason } satisfies SubmitOutcome

      /*
       * The server decides how many, from the validated payload, so its ids are
       * the truth. Falling back to the local count keeps the board honest if it
       * answered with none.
       */
      const rects = siblingRects(anchor, Math.max(result.nodeIds.length, 1))

      return {
        ok: true,
        nodes: rects.map((rect, index) => ({
          id: result.nodeIds[index] ?? `${result.jobId}:${index}`,
          assetId: null,
          ...rect,
          jobId: result.jobId,
          status: 'pending' as const,
          kind: null,
          label: null,
          url: null,
          durationMs: null,
          error: null,
        })),
        // Not an error: the generation is running, it just could not take every
        // reference. Saying so beats silently ignoring half the input.
        warning: result.dropped?.length
          ? `${model.displayName} could not take ${result.dropped.map((l) => `@${l}`).join(', ')}.`
          : null,
      } satisfies SubmitOutcome
    },
    [projectId, nodes, mentionables, centreOfView],
  )
}
