'use client'

import { Button } from '@genny/ui/button.tsx'
import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import { useState, useTransition } from 'react'
import { changePassword, deleteAccount } from '../server/account.ts'

/**
 * Changing a password and closing an account.
 *
 * Both are forms on a route rather than anything that covers the page: the
 * delete confirms in place, which is the same pattern the canvas list uses and
 * what the no-modal rule asks for. The confirmation says what actually goes,
 * because everything does.
 */
export function AccountPanel({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, save] = useTransition()
  const [closing, close] = useTransition()

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-ink text-sm">Account</h2>

      {hasPassword ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            save(async () => {
              const outcome = await changePassword({ current, next })
              setNotice(outcome.ok ? 'Password changed.' : (outcome.reason ?? 'Could not.'))
              if (outcome.ok) {
                setCurrent('')
                setNext('')
              }
            })
          }}
        >
          <Field
            id="current-password"
            label="Current password"
            value={current}
            onChange={setCurrent}
          />
          <Field id="next-password" label="New password" value={next} onChange={setNext} />
          <Button type="submit" tone="primary" size="sm" pending={saving}>
            Change password
          </Button>
        </form>
      ) : (
        <p className="text-ink-muted text-sm">
          This account signs in with Google, so there is no password here to change.
        </p>
      )}

      {notice ? (
        <p aria-live="polite" className="text-ink-muted text-sm">
          {notice}
        </p>
      ) : null}

      <div className="border-line border-t pt-4">
        <p className="mb-2 text-ink-muted text-sm">
          Closing this account removes every canvas, every asset and the whole credit history. None
          of it can be brought back.
        </p>
        <ConfirmInline
          label="Delete account"
          question="Delete everything, permanently?"
          confirmLabel="Yes, delete everything"
          onConfirm={() => close(async () => void (await deleteAccount()))}
          {...(closing ? { pending: true } : {})}
        />
      </div>
    </section>
  )
}

function Field(props: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="max-w-sm space-y-1">
      <label htmlFor={props.id} className="block text-ink-muted text-xs">
        {props.label}
      </label>
      <input
        id={props.id}
        type="password"
        autoComplete={props.id === 'next-password' ? 'new-password' : 'current-password'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-(--size-touch) w-full rounded-(--radius-control) border border-line bg-control px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  )
}
