import type { FullConfig } from '@playwright/test'

/**
 * Every page route, fetched once before any worker starts.
 *
 * `next dev` compiles a route the first time it is asked for, and three parallel
 * workers hitting a cold route means one of them waits behind the other two's
 * compilation. That showed up as assertions timing out on WebKit, in a different
 * test each run, which reads like a product bug and is not one.
 *
 * Sequential on purpose: the point is to pay each compile once, alone.
 */
const ROUTES = ['/', '/c', '/assets', '/billing', '/usage']

export default async function warmRoutes(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) return

  for (const route of ROUTES) {
    // A 404 compiles the route just as well as a 200, which is what byok returns
    // for the billing pages.
    await fetch(`${baseURL}${route}`).catch(() => {})
  }
}
