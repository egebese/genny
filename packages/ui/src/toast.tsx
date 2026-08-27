'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import type { AlertTone } from './alert-tone.ts'
import { autoDismisses, TOAST_MS } from './toast-policy.ts'

export type Toast = {
  id: number
  tone: AlertTone
  message: string
  /** One way to act on it, e.g. Undo or Retry. More than one is a dialog. */
  action?: { label: string; onAct: () => void }
}

export type ToastInput = Omit<Toast, 'id'>

type ToastApi = {
  toasts: Toast[]
  show: (toast: ToastInput) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 0

/**
 * One queue for the whole app.
 *
 * Before this there was no way to say anything from one place that a person
 * standing somewhere else would see: every message was a paragraph inside the
 * component that produced it, so "character deleted" or "credits added" could
 * only be told by mutating a list.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (input: ToastInput) => {
      const id = ++nextId
      setToasts((current) => [...current, { ...input, id }])
      if (autoDismisses(input.tone)) setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss])
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>
}

/**
 * Throws when no provider is above it, rather than silently swallowing the
 * message: a notification nobody sees is the bug this layer exists to fix.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast needs a ToastProvider above it')
  return api
}
