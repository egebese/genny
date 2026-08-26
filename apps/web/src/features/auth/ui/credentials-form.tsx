'use client'

import { Button } from '@genny/ui/button.tsx'
import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '../server/actions.ts'

type CredentialsFormProps = {
  action: (state: FormState, form: FormData) => Promise<FormState>
  heading: string
  blurb: string
  submitLabel: string
  /** New passwords get the manager's suggestion; existing ones get autofill. */
  mode: 'signin' | 'signup'
  alternative: { href: string; prompt: string; label: string }
}

export function CredentialsForm(props: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(props.action, { error: null })

  return (
    <form action={formAction} className="mx-auto w-full max-w-sm space-y-4 py-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">{props.heading}</h1>
        <p className="text-ink-muted text-sm">{props.blurb}</p>
      </div>

      <label className="block space-y-1" htmlFor="email">
        <span className="text-ink-muted text-sm">Email</span>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className="h-(--size-touch) w-full rounded-(--radius-control) border border-line bg-canvas px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <label className="block space-y-1" htmlFor="password">
        <span className="text-ink-muted text-sm">Password</span>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={props.mode === 'signup' ? 'new-password' : 'current-password'}
          className="h-(--size-touch) w-full rounded-(--radius-control) border border-line bg-canvas px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {props.mode === 'signup' ? (
          <span className="block text-ink-faint text-xs">At least 8 characters.</span>
        ) : null}
      </label>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" tone="primary" disabled={pending} className="w-full">
        {pending ? 'One moment' : props.submitLabel}
      </Button>

      <p className="text-ink-muted text-sm">
        {props.alternative.prompt}{' '}
        <Link href={props.alternative.href} className="text-accent underline underline-offset-2">
          {props.alternative.label}
        </Link>
      </p>
    </form>
  )
}
