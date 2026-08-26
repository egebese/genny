'use server'

import { findPlan } from '@genny/billing/plans.ts'
import { env } from '@genny/env/env.ts'
import { redirect } from 'next/navigation'
import { ensureActorId } from '@/features/session/actor.ts'
import { startCheckout } from './checkout.ts'

/**
 * Sends the visitor to Stripe. A server action rather than a route handler so the
 * form works without JavaScript and Next checks the origin for us.
 *
 * Nothing is granted here. Credits arrive only when Stripe tells the webhook the
 * money moved, which is also what makes an abandoned checkout a non-event.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  if (env().GENNY_MODE !== 'saas') redirect('/billing')

  // The only two shapes the form can carry. findPlan is the allowlist: an id that
  // is not in the catalogue of plans never reaches Stripe.
  const buy = formData.get('buy')
  const plan = typeof buy === 'string' ? findPlan(buy) : undefined
  if (!plan && buy !== 'topup') redirect('/billing?error=Unknown+plan')

  const actorId = await ensureActorId()
  const outcome = await startCheckout(
    actorId,
    plan ? { kind: 'subscription', plan: plan.id } : { kind: 'topup' },
  )

  // redirect throws, so both branches leave the action here.
  if (!outcome.ok) redirect(`/billing?error=${encodeURIComponent(outcome.reason)}`)
  redirect(outcome.url)
}
