'use client'

import { Button } from '@genny/ui/button.tsx'
import { useState, useTransition } from 'react'

type KeyGateProps = {
  onReady: () => void
}

/**
 * An inline panel, not a modal. It sits where the prompt would be, so nothing is
 * covered and nothing has to be dismissed before the page can be read.
 */
export function KeyGate({ onReady }: KeyGateProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /*
   * A fetch to a route handler rather than a server action: Next's dev logger
   * prints action arguments, and this argument is somebody's fal key.
   */
  function submit() {
    setError(null)
    startTransition(async () => {
      const response = await fetch('/api/session/fal-key', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      }).catch(() => null)

      const body = (await response?.json().catch(() => null)) as {
        ok: boolean
        reason?: string
      } | null

      if (response?.ok && body?.ok) {
        setKey('')
        onReady()
        return
      }
      setError(body?.reason ?? 'Could not save that key. Try again.')
    })
  }

  return (
    <form
      className="panel rounded-(--radius-panel) p-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="fal-key" className="font-medium text-sm">
        Paste your fal key to start
      </label>
      <p className="mt-1 text-ink-muted text-sm">
        It is encrypted into a cookie for 12 hours and never stored on the server. Get one at{' '}
        <a
          href="https://fal.ai/dashboard/keys"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-2"
        >
          fal.ai/dashboard/keys
        </a>
        .
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="fal-key"
          name="fal-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="key-id:key-secret"
          aria-invalid={error !== null}
          aria-describedby={error ? 'fal-key-error' : undefined}
          className="h-(--size-touch) min-w-0 flex-1 rounded-(--radius-control) border border-line bg-control px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" tone="primary" disabled={pending || key.trim().length < 20}>
          {pending ? 'Checking' : 'Start generating'}
        </Button>
      </div>

      {error ? (
        <p id="fal-key-error" role="alert" className="mt-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </form>
  )
}
