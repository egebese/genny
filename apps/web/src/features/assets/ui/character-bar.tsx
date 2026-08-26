'use client'

import { Button } from '@genny/ui/button.tsx'
import { useState } from 'react'
import type { MentionableView } from '../server/list.ts'

type CharacterBarProps = {
  selectedIds: string[]
  onCreated: (character: MentionableView) => void
  onClear: () => void
}

/**
 * Appears in the page when something is selected, rather than opening over it.
 * Naming a character is one field and one button, so a dialog would be three
 * extra decisions for no gain.
 */
export function CharacterBar({ selectedIds, onCreated, onClear }: CharacterBarProps) {
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create() {
    setError(null)
    setPending(true)
    const response = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, assetIds: selectedIds }),
    }).catch(() => null)

    const result = (await response?.json().catch(() => null)) as {
      ok: boolean
      character?: MentionableView
      reason?: string
    } | null
    setPending(false)

    if (result?.ok && result.character) {
      onCreated(result.character)
      setLabel('')
      onClear()
      return
    }
    setError(result?.reason ?? 'Could not create that character.')
  }

  return (
    <form
      className="rounded-(--radius-panel) border border-accent bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void create()
      }}
    >
      <label htmlFor="character-label" className="font-medium text-sm">
        Name these {selectedIds.length} image{selectedIds.length === 1 ? '' : 's'} as a character
      </label>
      <p className="mt-1 text-ink-muted text-sm">
        Mention it with <span className="font-mono">@name</span> and every image goes to the model
        at once, so a face or a place stays recognisable.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="character-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="ayse"
          className="h-(--size-touch) min-w-0 flex-1 rounded-(--radius-control) border border-line bg-canvas px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" tone="primary" disabled={pending || label.trim().length === 0}>
          {pending ? 'Creating' : 'Create character'}
        </Button>
        <Button type="button" tone="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </form>
  )
}
