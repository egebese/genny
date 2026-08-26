import { PLANS, TOPUP } from '@genny/billing/plans.ts'
import { env } from '@genny/env/env.ts'
import { Button } from '@genny/ui/button.tsx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { startCheckoutAction } from '@/features/billing/server/actions.ts'
import { creditBalance } from '@/features/billing/server/balance.ts'
import { readActorId } from '@/features/session/actor.ts'

export const metadata: Metadata = { title: 'Credits' }

type Search = { error?: string; bought?: string; subscribed?: string }

/**
 * Buying credits. A page rather than a modal, so the browser back button works
 * and a half-finished purchase is a URL you can return to.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (env().GENNY_MODE !== 'saas') notFound()

  const [balance, params] = await Promise.all([creditBalance(await readActorId()), searchParams])

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Credits</h1>
        <p className="text-ink-muted text-sm">
          {balance ? `${balance.credits.toLocaleString()} available` : 'No balance yet'}
          {balance && balance.held > 0 ? ` · ${balance.held.toLocaleString()} reserved` : ''}
        </p>
      </header>

      <Notice params={params} />

      <ul className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <li
            key={plan.id}
            className="flex flex-col gap-2 rounded-(--radius-panel) border border-line bg-surface p-4"
          >
            <span className="font-medium text-ink">{plan.name}</span>
            <span className="font-semibold text-2xl text-ink tabular-nums">
              ${plan.priceCents / 100}
              <span className="font-normal text-ink-faint text-sm">/mo</span>
            </span>
            <span className="text-ink-muted text-sm">
              {plan.credits.toLocaleString()} credits a month
            </span>
            <span className="flex-1 text-ink-faint text-xs">{plan.blurb}</span>
            <BuyButton value={plan.id} label="Subscribe" tone="primary" />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-panel) border border-line bg-surface p-4">
        <span className="text-sm">
          <span className="text-ink">One-off top-up</span>
          <span className="block text-ink-faint text-xs">
            {TOPUP.credits.toLocaleString()} credits for ${TOPUP.priceCents / 100}. Never expires.
          </span>
        </span>
        <BuyButton value="topup" label="Buy credits" tone="neutral" />
      </div>
    </main>
  )
}

function BuyButton({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone: 'primary' | 'neutral'
}) {
  return (
    <form action={startCheckoutAction}>
      <input type="hidden" name="buy" value={value} />
      <Button type="submit" tone={tone} size="sm" className="w-full">
        {label}
      </Button>
    </form>
  )
}

function Notice({ params }: { params: Search }) {
  if (params.error) {
    return (
      <p className="rounded-(--radius-control) border border-danger/40 bg-danger/5 px-3 py-2 text-danger text-sm">
        {params.error}
      </p>
    )
  }
  if (params.bought || params.subscribed) {
    return (
      <p className="rounded-(--radius-control) border border-accent/40 bg-accent/5 px-3 py-2 text-accent text-sm">
        Payment received. Credits land as soon as Stripe confirms it, usually within seconds.
      </p>
    )
  }
  return null
}
