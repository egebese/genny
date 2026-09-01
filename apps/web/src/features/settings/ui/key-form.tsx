'use client'

import { Button } from '@genny/ui/button.tsx'
import { useState, useTransition } from 'react'

/**
 * The one input that takes a fal key, wherever it is asked for.
 *
 * Two places now: the gate that replaces the dock on a board with no key, and
 * settings, where the same key can be replaced. Written once so the sentence
 * about the cookie, the twelve hours and where to get a key cannot drift into
 * two versions saying different things.
 *
 * A fetch to a route handler rather than a server action, which is the reason
 * the gate did it that way too: Next's dev logger prints action arguments, and
 * this argument is somebody's fal key.
 */
export function KeyForm(props: { label?: string; submitLabel?: string; onDone: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit() {
    setError(null)
    start(async () => {
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
        props.onDone()
        return
      }
      setError(body?.reason ?? 'Could not save that key. Try again.')
    })
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="fal-key" className="font-medium text-sm">
        {props.label ?? 'Paste your fal key to start'}
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
          {pending ? 'Checking' : (props.submitLabel ?? 'Start generating')}
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
