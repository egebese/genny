import type { AlertTone } from './alert-tone.ts'

/** How long a message stays. Long enough to read, short enough not to nag. */
export const TOAST_MS = 4000

/**
 * Whether a message clears itself.
 *
 * Everything goes away on its own except a failure: something went wrong and
 * the person may have been looking somewhere else, so that one waits to be
 * dismissed.
 *
 * Here rather than in toast.tsx because this is the only decision in the toast
 * layer worth testing, and a .tsx module cannot be imported by the test runner
 * under this package's jsx setting.
 */
export function autoDismisses(tone: AlertTone): boolean {
  return tone !== 'danger'
}
