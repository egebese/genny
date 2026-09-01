'use client'

import { KeyForm } from '@/features/settings/ui/key-form.tsx'

/**
 * What stands in for the dock on a board with no key.
 *
 * The only real gate in the app: byok spends the visitor's own fal balance, so
 * there is nothing to generate with until they say whose. The form itself is
 * shared with settings, where the same key can be replaced, so the sentence
 * about the cookie and the twelve hours has one home.
 */
export function KeyGate({ onReady }: { onReady: () => void }) {
  return (
    <div className="panel rounded-(--radius-panel) p-4">
      <KeyForm onDone={onReady} />
    </div>
  )
}
