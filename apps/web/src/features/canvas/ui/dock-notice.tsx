'use client'

import type { PickableModel } from '../model-list.ts'

export type DockBlock =
  | { kind: 'needs-reference' }
  | { kind: 'cannot-take'; instead: PickableModel | null }
  | null

/**
 * Why generate is disabled, and what to do instead.
 *
 * Both of these are things the dock already knows from the model's own catalog
 * entry, and both used to be found out by spending: an editing model answered
 * 422 from fal, and a text to image model quietly ran without the reference and
 * reported the drop after the money.
 */
export function whyBlocked(context: {
  model: PickableModel
  suggestion: PickableModel | null
  mentionCount: number
  attachmentCount: number
  carrying: boolean
}): DockBlock {
  const { model } = context
  if (context.carrying && model.slots.length === 0) {
    return { kind: 'cannot-take', instead: context.suggestion }
  }
  if (model.requiresReference && context.mentionCount === 0 && context.attachmentCount === 0) {
    return { kind: 'needs-reference' }
  }
  return null
}

export function DockNotice(props: {
  block: DockBlock
  model: PickableModel
  onModelChange: (model: PickableModel) => void
}) {
  if (!props.block) return null

  if (props.block.kind === 'needs-reference') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        {props.model.displayName} edits an image. Mention one with{' '}
        <span className="font-mono">@</span> to say which.
      </p>
    )
  }

  const instead = props.block.instead
  return (
    <p className="flex flex-wrap items-center gap-2 border-line border-t px-4 py-2 text-ink-muted text-sm">
      <span>
        {props.model.displayName} makes images from text alone and cannot use a reference.
      </span>
      {instead ? (
        <button
          type="button"
          onClick={() => props.onModelChange(instead)}
          className="rounded-(--radius-control) bg-control px-2 py-1 text-ink text-xs outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
        >
          Use {instead.displayName}
        </button>
      ) : null}
    </p>
  )
}
