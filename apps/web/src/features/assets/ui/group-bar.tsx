'use client'

import { Button } from '@genny/ui/button.tsx'
import { useState } from 'react'
import type { MentionableView } from '../server/list.ts'

const KINDS = [
  { kind: 'character', label: 'Character', hint: 'a face or a figure that recurs' },
  { kind: 'product', label: 'Product', hint: 'the same thing from several angles' },
  { kind: 'style', label: 'Style', hint: 'a look to hold across shots' },
  { kind: 'set', label: 'Set', hint: 'a place or a scene' },
] as const

type GroupBarProps = {
  selectedIds: string[]
  /** What the analysis thinks these are, when it has an opinion. */
  suggestion?: { kind: string; label: string } | undefined
  onCreated: (group: MentionableView) => void
  onClear: () => void
}

/**
 * Appears in the page when something is selected, rather than opening over it.
 * Naming a set is one field and one button, so a dialog would be three extra
 * decisions for no gain.
 */
export function GroupBar({ selectedIds, suggestion, onCreated, onClear }: GroupBarProps) {
  const [label, setLabel] = useState(suggestion?.label ?? '')
  const [kind, setKind] = useState<string>(suggestion?.kind ?? 'character')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create() {
    setError(null)
    setPending(true)
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, kind, assetIds: selectedIds }),
    }).catch(() => null)

    const result = (await response?.json().catch(() => null)) as {
      ok: boolean
      group?: MentionableView
      reason?: string
    } | null
    setPending(false)

    if (result?.ok && result.group) {
      onCreated(result.group)
      setLabel('')
      onClear()
      return
    }
    setError(result?.reason ?? 'Could not create that group.')
  }

  return (
    <form
      className="rounded-(--radius-panel) border border-accent bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void create()
      }}
    >
      <label htmlFor="group-label" className="font-medium text-sm">
        Group these {selectedIds.length} image{selectedIds.length === 1 ? '' : 's'}
      </label>
      <p className="mt-1 text-ink-muted text-sm">
        Mention it with <span className="font-mono">@name</span> and every image goes to the model
        at once, so a face, a product or a place stays recognisable.
      </p>

      <fieldset className="mt-3 flex flex-wrap gap-1.5">
        <legend className="sr-only">What these are</legend>
        {KINDS.map((option) => (
          <button
            key={option.kind}
            type="button"
            title={option.hint}
            aria-pressed={kind === option.kind}
            onClick={() => setKind(option.kind)}
            className={
              kind === option.kind
                ? 'rounded-(--radius-control) bg-surface-hover px-3 py-1.5 font-medium text-ink text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent'
                : 'rounded-(--radius-control) px-3 py-1.5 text-ink-muted text-sm outline-none hover:bg-control hover:text-ink focus-visible:ring-2 focus-visible:ring-accent'
            }
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="group-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="ayse"
          className="h-(--size-touch) min-w-0 flex-1 rounded-(--radius-control) border border-line bg-control px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" tone="primary" disabled={pending || label.trim().length === 0}>
          {pending ? 'Creating' : 'Create group'}
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
