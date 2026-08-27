'use client'

import type { MentionableView } from '../server/list.ts'

type CharacterListProps = {
  characters: MentionableView[]
  onDeleted: (id: string) => void
}

export function CharacterList({ characters, onDeleted }: CharacterListProps) {
  if (characters.length === 0) return null

  async function remove(id: string) {
    const response = await fetch(`/api/characters?id=${id}`, { method: 'DELETE' }).catch(() => null)
    if (response?.ok) onDeleted(id)
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">Characters</h2>
      <ul className="flex flex-wrap gap-2">
        {characters.map((character) => (
          <li
            key={character.id}
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2 pl-1"
          >
            {character.previewUrl ? (
              <img
                src={character.previewUrl}
                alt=""
                loading="lazy"
                className="size-7 rounded-full object-cover"
              />
            ) : (
              <span className="size-7 rounded-full bg-canvas" />
            )}
            <span className="font-mono text-ink text-sm">@{character.label}</span>
            <span className="text-ink-faint text-xs">{character.count}</span>
            <button
              type="button"
              onClick={() => void remove(character.id)}
              aria-label={`Delete character ${character.label}`}
              className="rounded-full px-1.5 text-ink-faint hover:text-danger outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
