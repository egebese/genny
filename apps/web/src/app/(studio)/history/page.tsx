import type { Metadata } from 'next'
import Link from 'next/link'
import { readActorId } from '@/features/session/actor.ts'
import { historyPage } from '@/features/studio/server/history.ts'

export const metadata: Metadata = { title: 'History' }

/**
 * Every generation, with what it was asked for and how it ended. The studio feed
 * shows the same rows as pictures; this shows them as a record, which is what you
 * want when something failed and you are trying to work out why.
 */
export default async function HistoryPage() {
  const actorId = await readActorId()
  const { items } = actorId ? await historyPage(actorId) : { items: [] }

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="font-semibold text-2xl tracking-tight">History</h1>
        <p className="py-12 text-center text-ink-faint">
          Nothing yet.{' '}
          <Link href="/image" className="text-accent underline underline-offset-2">
            Generate something
          </Link>
          .
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6">
      <h1 className="font-semibold text-2xl tracking-tight">History</h1>

      <ul className="divide-y divide-line overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
        {items.map((item) => (
          <li key={item.jobId} className="flex items-start gap-3 p-3">
            <span className="size-12 shrink-0 overflow-hidden rounded-(--radius-control) bg-canvas">
              {item.urls[0] ? (
                <img src={item.urls[0]} alt="" loading="lazy" className="size-full object-cover" />
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink text-sm">{item.prompt}</span>
              <span className="block text-ink-faint text-xs">{item.modelName}</span>
              {item.error ? (
                <span className="mt-1 block text-danger text-xs">{item.error}</span>
              ) : null}
            </span>

            <StatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed' ? 'text-accent' : status === 'failed' ? 'text-danger' : 'text-ink-faint'
  return <span className={`shrink-0 text-xs ${tone}`}>{status}</span>
}
