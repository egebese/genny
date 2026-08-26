import { defineConfig, devices } from '@playwright/test'

/**
 * The mode is a real axis of behaviour, not a config detail: byok spends the
 * visitor's key and has no credits, saas spends ours and does. Every scenario
 * runs under whichever mode the suite was started with, and CI runs both, so a
 * change that only works in one mode fails before it ships.
 */
const mode = process.env.GENNY_MODE ?? 'byok'
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://127.0.0.1:${port}`

function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Tagged @live tests spend real money on a real fal key. Opt in explicitly.
  // Spread rather than `undefined`: exactOptionalPropertyTypes distinguishes an
  // absent option from one explicitly set to undefined, and Playwright's types
  // only accept the former.
  ...(process.env.E2E_LIVE ? {} : { grepInvert: /@live/ }),
  // Compiles every route once before the workers start. Without it the first
  // worker to reach a cold route waits behind `next dev` building it, which
  // surfaced as a different WebKit assertion timing out on each run.
  globalSetup: './global-setup.ts',
  /*
   * 10s rather than the 5s default, on top of the warm-up. A dev build's first
   * paint is slow even once compiled, and WebKit at a phone viewport is the
   * slowest combination the suite runs.
   */
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: `desktop-${mode}`, use: { ...devices['Desktop Chrome'] } },
    // The phone layout is a first-class target, not a courtesy. It gets the same
    // scenarios, not a reduced subset.
    { name: `mobile-${mode}`, use: { ...devices['Pixel 7'] } },
    // iOS Safari separately, because it is the browser with the strictest rules
    // about autoplay, safe areas and viewport units, and those are exactly the
    // things an app-like layout leans on.
    { name: `ios-${mode}`, use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'pnpm --filter @genny/web dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: '..',
    env: {
      // Playwright REPLACES the environment when this is set rather than merging
      // into it, so the inherited variables (and PATH) have to be passed through
      // explicitly or the server starts with almost no configuration.
      ...inheritedEnv(),
      GENNY_MODE: mode,
      PORT: String(port),
      // saas mode refuses to boot without these, by design. The suite mocks fal
      // and Stripe, so placeholders are correct here: a real key in a test
      // environment is a key that eventually gets spent by accident.
      // `||`, not `??`: a .env file writes FAL_KEY= as an empty string, which is
      // present but useless, and ?? would happily pass it through.
      ...(mode === 'saas'
        ? {
            FAL_KEY: process.env.FAL_KEY || 'e2e-placeholder:not-a-real-key',
            STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_e2e_placeholder',
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_e2e_placeholder',
            // Trial credits, so the suite can exercise the credit paths without
            // a payment provider.
            CREDIT_SIGNUP_GRANT: process.env.CREDIT_SIGNUP_GRANT || '500',
            // Turns the reconcile route on so the suite can check who it lets in.
            CRON_SECRET: 'e2e_cron_secret',
          }
        : {}),
    },
  },
})
