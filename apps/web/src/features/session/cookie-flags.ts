import { env } from '@genny/env/env.ts'

/**
 * Whether our cookies may carry the Secure flag.
 *
 * Taken from APP_URL rather than from NODE_ENV, because Secure is about the
 * origin and nothing else: a Secure cookie sent over plain http is dropped by
 * the browser, and the session then silently fails to exist.
 *
 * NODE_ENV got this wrong in both directions. A production build served over
 * http loses every session, and WebKit proved the reverse in the e2e suite,
 * where Chrome's localhost exemption hid the same bug for two of three browsers.
 */
export function secureCookies(): boolean {
  return env().APP_URL.startsWith('https://')
}
