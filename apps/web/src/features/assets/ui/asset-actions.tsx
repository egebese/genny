'use client'

import { Button } from '@genny/ui/button.tsx'
import { useState } from 'react'

/**
 * Renaming and deleting one asset, in place.
 *
 * Outside the card's `<label>` on purpose: the whole card is the checkbox's
 * label, so a button nested inside it would select the asset on the way to
 * being pressed.
 *
 * The delete confirms inline rather than in a dialog, and the rename is an
 * input that appears where the name was. Both are the no-modal rule doing its
 * job: a confirmation that covers the grid hides the twelve other things you
 * were comparing before deciding.
 */
export function AssetActions(props: {
  id: string
  label: string
  onRenamed: (id: string, label: string) => void
  onDeleted: (id: string) => void
}) {
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirming'>('idle')
  const [draft, setDraft] = useState(props.label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function rename() {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/assets/${props.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: draft }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null)
    setBusy(false)

    if (!body?.ok) return setError(body?.reason ?? 'Could not rename that.')
    props.onRenamed(props.id, body.asset.label)
    setMode('idle')
  }

  async function remove() {
    setBusy(true)
    const response = await fetch(`/api/assets/${props.id}`, { method: 'DELETE' }).catch(() => null)
    const body = await response?.json().catch(() => null)
    setBusy(false)

    if (!body?.ok) {
      setMode('idle')
      return setError(body?.reason ?? 'Could not delete that.')
    }
    props.onDeleted(props.id)
  }

  if (mode === 'renaming') {
    return (
      <form
        className="flex items-center gap-1 px-3 pb-3"
        onSubmit={(event) => {
          event.preventDefault()
          void rename()
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Handle for ${props.label}`}
          className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-canvas px-2 py-1 font-mono text-ink text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" tone="primary" size="sm" pending={busy}>
          Save
        </Button>
        <Button type="button" tone="ghost" size="sm" onClick={() => setMode('idle')}>
          Cancel
        </Button>
      </form>
    )
  }

  if (mode === 'confirming') {
    return (
      <div className="flex items-center gap-2 px-3 pb-3">
        <p className="min-w-0 flex-1 text-ink-muted text-xs">Delete for good?</p>
        <Button type="button" tone="danger" size="sm" pending={busy} onClick={() => void remove()}>
          Delete
        </Button>
        <Button type="button" tone="ghost" size="sm" onClick={() => setMode('idle')}>
          Keep
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      {error ? (
        <p role="alert" className="min-w-0 flex-1 truncate text-danger text-xs">
          {error}
        </p>
      ) : (
        <span className="flex-1" />
      )}
      <Button
        type="button"
        tone="ghost"
        size="sm"
        onClick={() => {
          setDraft(props.label)
          setMode('renaming')
        }}
      >
        Rename
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={() => setMode('confirming')}>
        Delete
      </Button>
    </div>
  )
}
