'use client'

import { Button } from '@genny/ui/button.tsx'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FalKeyStatus } from '@/features/session/fal-key.ts'
import { KeyForm } from './key-form.tsx'

/**
 * The stored fal key: whether there is one, roughly which, when it stops
 * working, and the two things that were impossible before.
 *
 * `DELETE /api/session/fal-key` has existed since the key gate landed and no UI
 * ever called it, so a key pasted once could be neither replaced nor cleared
 * until the twelve hour cookie expired on its own. The key itself never crosses
 * to the browser; the hint is the leading characters of the key id, which is
 * the half fal prints in its own dashboard.
 */
export function FalKeyPanel({ status }: { status: FalKeyStatus }) {
  const router = useRouter()
  const [replacing, setReplacing] = useState(false)
  const [clearing, setClearing] = useState(false)

  if (status.mode === 'saas') return null

  async function clear() {
    setClearing(true)
    await fetch('/api/session/fal-key', { method: 'DELETE' }).catch(() => null)
    setClearing(false)
    router.refresh()
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-ink text-sm">fal key</h2>

      {status.present ? (
        <p className="text-ink-muted text-sm">
          <span className="font-mono text-ink">{status.hint}</span> in use, until{' '}
          <time dateTime={new Date(status.expiresAt).toISOString()}>
            {new Date(status.expiresAt).toISOString().slice(0, 16).replace('T', ' ')}
          </time>
          . It is sealed into a cookie and never stored on the server, so it goes when that expires.
        </p>
      ) : (
        <p className="text-ink-muted text-sm">
          No key stored. Nothing can be generated without one.
        </p>
      )}

      {replacing || !status.present ? (
        <KeyForm
          onDone={() => {
            setReplacing(false)
            router.refresh()
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" tone="ghost" size="sm" onClick={() => setReplacing(true)}>
            Replace
          </Button>
          <Button
            type="button"
            tone="ghost"
            size="sm"
            pending={clearing}
            onClick={() => void clear()}
          >
            Clear
          </Button>
        </div>
      )}
    </section>
  )
}
