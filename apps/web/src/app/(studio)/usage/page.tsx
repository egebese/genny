import { env } from '@genny/env/env.ts'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { creditBalance } from '@/features/billing/server/balance.ts'
import { usageReport } from '@/features/billing/server/usage.ts'
import { jobHistory } from '@/features/jobs/server/history.ts'
import { JobHistory } from '@/features/jobs/ui/job-history.tsx'
import { readActorId } from '@/features/session/actor.ts'

export const metadata: Metadata = { title: 'Usage' }

/**
 * Where the credits went, and what became of every generation.
 *
 * The ledger half is saas only, because byok has no credits to account for. The
 * history half is both: a generation that failed leaves nothing on the board, so
 * without this page a byok user has no way at all to find out why.
 */
export default async function UsagePage() {
  const saas = env().GENNY_MODE === 'saas'

  const actorId = await readActorId()
  if (!actorId) notFound()

  const [balance, report, history] = await Promise.all([
    saas ? creditBalance(actorId) : null,
    saas ? usageReport(actorId) : null,
    jobHistory(actorId),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">Usage</h1>
        {saas ? (
          <Link href="/billing" className="text-accent text-sm underline underline-offset-2">
            Buy credits
          </Link>
        ) : null}
      </header>

      {report ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Available" value={(balance?.credits ?? 0).toLocaleString()} />
            <Stat
              label="Spent this month"
              value={Math.round(Number(report.thisMonth.credits)).toLocaleString()}
            />
            <Stat label="Generations" value={report.thisMonth.generations.toLocaleString()} />
            <Stat label="Plan" value={`${report.planName} · ${report.hourlyLimit}/hr`} />
          </dl>

          {report.entries.length === 0 ? (
            <p className="py-12 text-center text-ink-faint">Nothing on the ledger yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
              {report.entries.map((entry) => (
                <li
                  key={`${entry.createdAt.toISOString()}-${entry.jobId ?? entry.kind}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">
                      {entry.prompt ?? entry.note ?? entry.kind}
                    </span>
                    <span className="block text-ink-faint text-xs">
                      <time dateTime={entry.createdAt.toISOString()}>
                        {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </time>
                    </span>
                  </span>
                  <Delta delta={entry.delta} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold text-ink text-sm">Generations</h2>
        <JobHistory entries={history} />
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-panel) border border-line bg-surface p-3">
      <dt className="text-ink-faint text-xs">{label}</dt>
      <dd className="font-semibold text-ink text-lg tabular-nums">{value}</dd>
    </div>
  )
}

function Delta({ delta }: { delta: string }) {
  const amount = Number(delta)
  const rounded = Math.round(Math.abs(amount)).toLocaleString()
  return (
    <span className={`shrink-0 tabular-nums ${amount < 0 ? 'text-ink-muted' : 'text-accent'}`}>
      {amount < 0 ? '−' : '+'}
      {rounded}
    </span>
  )
}
