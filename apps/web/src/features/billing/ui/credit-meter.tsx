import Link from 'next/link'
import { readActorId } from '@/features/session/actor.ts'
import { creditBalance } from '../server/balance.ts'

/**
 * The balance, in the topbar, on every studio page. Running out mid-session is
 * the worst moment to discover the number, so it is always on screen. It links
 * to usage rather than to checkout: the first question about a number going down
 * is what spent it.
 *
 * Renders nothing in byok mode, where credits do not exist.
 */
export async function CreditMeter() {
  const balance = await creditBalance(await readActorId())
  if (!balance) return null

  return (
    <Link
      href="/usage"
      className="rounded-(--radius-control) px-2 py-1 text-ink-muted text-sm tabular-nums hover:bg-surface hover:text-ink"
    >
      {balance.credits.toLocaleString()}
      <span className="text-ink-faint"> credits</span>
    </Link>
  )
}
