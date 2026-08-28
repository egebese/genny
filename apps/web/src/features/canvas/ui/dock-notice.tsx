'use client'

import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'

export type DockBlock =
  | { kind: 'needs-reference' }
  | { kind: 'cannot-take' }
  | { kind: 'needs-setting'; label: string }
  | null

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
  /** What the dock is holding, so a list the model insists on can be checked. */
  settings: Record<string, unknown>
}): DockBlock {
  /*
   * Two ways nothing resolves, and they are opposite problems. Nothing was
   * handed over and every task in the family insists on something: that model
   * needs an image. Something was handed over and no task can take it: that
   * model cannot use it. Saying the second when the first is true tells someone
   * their empty prompt is the wrong shape.
   *
   * The first branch is how an upscaler presents itself. It has no prompt to
   * type at, so the only thing that can be missing is the picture, and this is
   * the sentence that asks for it. The second is still waiting for a model that
   * can be handed something it has nowhere to put.
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
  /*
   * A control the endpoint refuses to run without, still empty.
   *
   * `required-inputs-can-arrive` lets a visible required control ship without a
   * default, because several of them have none that would work: an empty list
   * fails fal's own minimum, and MiniMax Music wants lyrics. This is the other
   * half of that exemption. Without it the generation is refused by the model's
   * own schema after the money, which is the failure the rule exists to prevent.
   */
  const empty = context.model.inputs.find((input) => {
    if (!input.required || input.default !== undefined) return false
    const held = context.settings[input.name]
    if (input.type === 'object-array') return !Array.isArray(held) || held.length === 0
    return held === undefined || held === null || held === ''
  })
  return empty ? { kind: 'needs-setting', label: empty.label } : null
}

export function DockNotice(props: { block: DockBlock; family: PickableFamily }) {
  if (!props.block) return null

  if (props.block.kind === 'needs-setting') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        {props.family.name} will not run without{' '}
        <span className="text-ink">{props.block.label.toLowerCase()}</span>. Set it below.
      </p>
    )
  }

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
