/**
 * Where fal should call back, or undefined when it cannot.
 *
 * saas only, because the callback settles the job with the deployment's own key
 * and a byok generation has none. Loopback and private hosts are skipped: fal
 * dials from the internet, and registering an address it cannot reach turns a
 * fast path into a silently dead one.
 */
export function falWebhookUrl(input: {
  mode: 'byok' | 'saas'
  appUrl: string
}): string | undefined {
  if (input.mode !== 'saas') return undefined

  let host: string
  try {
    const url = new URL(input.appUrl)
    if (url.protocol !== 'https:') return undefined
    host = url.hostname
  } catch {
    return undefined
  }

  const unreachable =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (unreachable) return undefined

  return new URL('/api/webhooks/fal', input.appUrl).toString()
}
