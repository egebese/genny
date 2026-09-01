import { ownerDb } from '@genny/db/connection.ts'
import { findPasswordHash } from '@genny/db/repositories/actors.ts'
import { env } from '@genny/env/env.ts'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { billingPortalUrl } from '@/features/billing/server/portal.ts'
import { readActorId } from '@/features/session/actor.ts'
import { falKeyStatus } from '@/features/session/fal-key.ts'
import { AccountPanel } from '@/features/settings/ui/account-panel.tsx'
import { FalKeyPanel } from '@/features/settings/ui/fal-key-panel.tsx'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Settings' }

/**
 * The things that were configurable everywhere except in the product.
 *
 * A route, not a panel over anything: `/settings` is where a settings page
 * goes, and a surface that makes the rest of the page inert is the one thing
 * this codebase does not build.
 *
 * Each section is gated by whether it means anything. byok has a fal key and no
 * subscription; saas has a subscription and ignores any key the visitor pastes.
 */
export default async function SettingsPage() {
  const actorId = await readActorId()
  if (!actorId) notFound()

  const config = env()
  const [key, portal, passwordHash] = await Promise.all([
    falKeyStatus(),
    billingPortalUrl(actorId),
    findPasswordHash(ownerDb(config.DATABASE_MIGRATION_URL ?? config.DATABASE_URL), actorId),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-6">
      <header>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      </header>

      <FalKeyPanel status={key} />

      {portal ? (
        <section className="space-y-2">
          <h2 className="font-semibold text-ink text-sm">Billing</h2>
          <p className="text-ink-muted text-sm">
            Payment method, invoices and cancelling a subscription are handled by Stripe, so no card
            number ever reaches this application.
          </p>
          <Link
            href={portal}
            className="inline-block text-accent text-sm underline underline-offset-2"
          >
            Open the billing portal
          </Link>
        </section>
      ) : null}

      <AccountPanel hasPassword={passwordHash !== null} />
    </main>
  )
}
