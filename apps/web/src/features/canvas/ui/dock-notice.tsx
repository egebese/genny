'use client'

import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'

export type DockBlock = { kind: 'needs-reference' } | { kind: 'cannot-take' } | null

/**
 * Why generate is disabled.
 *
 * Both cases are things the dock already knows from the catalog, and both used
 * to be found out by spending: an editing endpoint answered 422 from fal, and a
 * text to image endpoint quietly ran without the reference and reported the
 * drop after the money.
 *
 * There used to be a third case here, and a button offering a different model
 * to fix it. Attaching an image to Nano Banana 2 now simply reaches Nano Banana
 * 2's edit endpoint, so there is nothing to offer and nothing to explain.
 */
export function whyBlocked(context: {
  family: PickableFamily
  model: PickableModel | null
  mentionCount: number
  attachmentCount: number
  carrying: boolean
}): DockBlock {
  /*
   * Two ways nothing resolves, and they are opposite problems. Nothing was
   * handed over and every task in the family insists on something: that model
   * needs an image. Something was handed over and no task can take it: that
   * model cannot use it. Saying the second when the first is true tells someone
   * their empty prompt is the wrong shape.
   *
   * Neither branch is reachable from today's catalog: every family shipped has
   * a task that runs on text alone, which is the point of grouping them. They
   * are here for the model that does not, and for the moment fal adds one.
   */
  if (!context.model) {
    return context.carrying ? { kind: 'cannot-take' } : { kind: 'needs-reference' }
  }
  if (
    context.model.requiresReference &&
    context.mentionCount === 0 &&
    context.attachmentCount === 0
  ) {
    return { kind: 'needs-reference' }
  }
  return null
}

export function DockNotice(props: { block: DockBlock; family: PickableFamily }) {
  if (!props.block) return null

  if (props.block.kind === 'needs-reference') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        {props.family.name} works from an image. Mention one with{' '}
        <span className="font-mono">@</span> or attach one to say which.
      </p>
    )
  }

  return (
    <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
      {props.family.name} has no way to take that.{' '}
      {props.family.accepts.length > 0
        ? `It works from ${props.family.accepts.join(' or ')}.`
        : 'It writes from text alone.'}
    </p>
  )
}
