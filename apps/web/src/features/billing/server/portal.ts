import 'server-only'
import { stripeClient } from '@genny/billing/stripe-client.ts'
import { env } from '@genny/env/env.ts'
import { findOrCreateCustomer } from './checkout.ts'

/**
 * A link into Stripe's own billing portal.
 *
 * Changing a card and cancelling a subscription are things the PRD asks for and
 * there was no code for either, so a subscriber's only route out was to email
 * somebody. Stripe hosts the whole flow, which is also the version where no
 * card number ever touches this application.
 */
export async function billingPortalUrl(actorId: string): Promise<string | null> {
  const config = env()
  if (config.GENNY_MODE !== 'saas' || !config.STRIPE_SECRET_KEY) return null

  const stripe = stripeClient(config.STRIPE_SECRET_KEY)
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: await findOrCreateCustomer(stripe, actorId),
      return_url: `${config.APP_URL}/settings`,
    })
    return session.url
  } catch {
    // Most often the portal has no configuration in the Stripe dashboard yet,
    // which is a deployment's own setup rather than anything a visitor can act
    // on. The settings page simply does not offer the link.
    return null
  }
}
