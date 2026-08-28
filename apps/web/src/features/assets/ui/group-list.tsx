'use client'

import type { MentionableView } from '../server/list.ts'

type GroupListProps = {
  groups: MentionableView[]
  onDeleted: (id: string) => void
}

export function GroupList({ groups, onDeleted }: GroupListProps) {
  if (groups.length === 0) return null

  async function remove(id: string) {
    const response = await fetch(`/api/groups?id=${id}`, { method: 'DELETE' }).catch(() => null)
    if (response?.ok) onDeleted(id)
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">Groups</h2>
      <ul className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex items-center gap-2 rounded-(--radius-control) bg-control py-1 pr-2 pl-1"
          >
            {group.previewUrl ? (
              <img
                src={group.previewUrl}
                alt=""
                loading="lazy"
                className="size-7 rounded-full object-cover"
              />
            ) : (
              <span className="size-7 rounded-full bg-control" />
            )}
            <span className="font-mono text-ink text-sm">@{group.label}</span>
            <span className="text-ink-faint text-xs">{group.count}</span>
            <button
              type="button"
              onClick={() => void remove(group.id)}
              aria-label={`Delete group ${group.label}`}
              className="rounded-(--radius-control) px-1.5 text-ink-faint outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-accent"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
