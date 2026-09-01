import type { HistoryEntry } from '../server/history.ts'

/**
 * Every generation, in the order they were asked for.
 *
 * A failure is the row worth reading here, so it carries its reason inline
 * rather than behind a click: the point of the list is that somebody who is
 * looking at an empty board can find out why.
 */
export function JobHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-12 text-center text-ink-faint">No generations yet.</p>
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ink">{entry.prompt || entry.model}</span>
            <span className="block text-ink-faint text-xs">
              {entry.model}
              {' · '}
              <time dateTime={entry.createdAt.toISOString()}>
                {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
              </time>
            </span>
            {entry.error ? (
              <span className="mt-1 block text-danger text-xs">{entry.error}</span>
            ) : null}
          </span>
          <Status status={entry.status} />
        </li>
      ))}
    </ul>
  )
}

function Status({ status }: { status: HistoryEntry['status'] }) {
  const tone =
    status === 'failed' ? 'text-danger' : status === 'completed' ? 'text-ink-muted' : 'text-accent'
  return <span className={`shrink-0 text-xs ${tone}`}>{status}</span>
}
