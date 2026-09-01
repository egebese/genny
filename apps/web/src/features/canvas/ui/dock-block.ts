import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import { quoteAgainstBalance } from './quote.ts'

export type DockBlock =
  | { kind: 'needs-reference' }
  | { kind: 'cannot-take' }
  | { kind: 'needs-setting'; label: string }
  | { kind: 'needs-credits'; short: number }
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
export function whyBlocked(input: {
  family: PickableFamily
  model: PickableModel | null
  mentionCount: number
  attachments: number
  mentions: number
  /** What the dock is holding, so a list the model insists on can be checked. */
  settings: Record<string, unknown>
  /** Null in byok, where the visitor spends their own fal balance and we hold
   * nothing of theirs to run out of. */
  credits: { enabled: boolean; perUsd: number; balance: number } | null
  prompt: string
}): DockBlock {
  const context = {
    ...input,
    attachmentCount: input.attachments,
    carrying: input.mentions > 0 || input.attachments > 0,
    cost: quoteAgainstBalance(input.model, input.settings, input.prompt, input.credits),
  }
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
  if (empty) return { kind: 'needs-setting', label: empty.label }

  /*
   * Last, because it is the only one that is about the account rather than the
   * request: fixing an empty control is what someone does first, and being told
   * to buy credits before being told the prompt is unusable is the wrong order.
   *
   * The balance is fetched and threaded all the way to this dock and was then
   * dropped, so an empty account was discovered by pressing Generate and reading
   * a generic error. The server quotes again and holds; this is the same
   * arithmetic, early enough to be useful.
   */
  if (context.cost && context.cost.credits > context.cost.balance) {
    return { kind: 'needs-credits', short: Math.ceil(context.cost.credits - context.cost.balance) }
  }

  return null
}
