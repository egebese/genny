'use client'

import { Alert } from './alert.tsx'
import { Button } from './button.tsx'
import { useToast } from './toast.tsx'

/**
 * Where the queue is drawn.
 *
 * Top centre, under the topbar: the bottom belongs to the dock on every screen
 * size, and on a phone a message over the dock covers the one control that
 * matters. It never takes focus, so it cannot interrupt typing.
 */
export function ToastRegion() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-(--spacing-safe-top) z-30 flex flex-col items-center gap-2 px-4 pt-16">
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          tone={toast.tone}
          className="pointer-events-auto w-full max-w-md shadow-(--shadow-dock)"
          action={
            <span className="flex shrink-0 items-center gap-1">
              {toast.action ? (
                <Button
                  type="button"
                  tone="ghost"
                  size="sm"
                  onClick={() => {
                    toast.action?.onAct()
                    dismiss(toast.id)
                  }}
                >
                  {toast.action.label}
                </Button>
              ) : null}
              <Button
                type="button"
                tone="ghost"
                size="sm"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
              >
                ×
              </Button>
            </span>
          }
        >
          {toast.message}
        </Alert>
      ))}
    </div>
  )
}
