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
  /*
   * The live suite talks to a rate-limited service and ingests what comes back
   * through one server process. Nine workers each running ten real generations
   * turned a 16 second test into a three minute one and then into a timeout,
   * which says nothing about the product. The mocked suite still runs wide.
   */
  ...(process.env.E2E_LIVE ? { workers: 2 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Tagged @live tests spend real money on a real fal key. Opt in explicitly.
  // Spread rather than `undefined`: exactOptionalPropertyTypes distinguishes an
  // absent option from one explicitly set to undefined, and Playwright's types
  // only accept the former.
  ...(process.env.E2E_LIVE ? {} : { grepInvert: /@live/ }),
  // Warms every route once before the workers start. Cheap insurance either way,
  // and it still matters when someone points the suite at their own dev server.
  globalSetup: './global-setup.ts',
  /*
   * 10s rather than the 5s default. WebKit at a phone viewport is the slowest
   * combination the suite runs, and nine workers share one server.
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
  /*
   * A production build, not `next dev`.
   *
   * Nine workers against one dev server meant a different assertion timed out on
   * roughly every third run: dev compiles per request, renders slower, and has
   * no output caching, so the suite was measuring the dev server rather than the
   * app. Building first costs a few seconds and makes the whole matrix faster.
   *
   * `E2E_DEV=1` puts the dev server back, for debugging a failure with HMR.
   */
  webServer: {
    command: process.env.E2E_DEV
      ? 'pnpm --filter @genny/web dev'
      : 'pnpm --filter @genny/web build && pnpm --filter @genny/web start',
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
      // The origin the suite actually uses. Cookies take their Secure flag from
      // this, and a Secure cookie over plain http is a cookie the browser drops.
      APP_URL: baseURL,
      // saas mode refuses to boot without these, by design. The suite mocks fal
      // and Stripe, so placeholders are correct here: a real key in a test
      // environment is a key that eventually gets spent by accident.
      //
      // Inherited only under E2E_LIVE. Anyone who has ever run the fal CLI has
      // FAL_KEY exported from their shell profile, and passing it through meant
      // the scenarios that assert on a generation failing to start watched one
      // succeed instead. They failed on that laptop and passed in CI, which is
      // the direction that wastes the most time.
      // `||`, not `??`: a .env file writes FAL_KEY= as an empty string, which is
      // present but useless, and ?? would happily pass it through.
      ...(mode === 'saas'
        ? {
            FAL_KEY:
              (process.env.E2E_LIVE ? process.env.FAL_KEY : '') || 'e2e-placeholder:not-a-real-key',
            STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_e2e_placeholder',
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_e2e_placeholder',
            // Trial credits, so the suite can exercise the credit paths without
            // a payment provider.
            //
            // Five thousand, not five hundred: the dock now refuses a run the
            // balance cannot cover, and one second of an H3 LoRA video is about
            // twelve hundred credits. At the old figure the scenarios about
            // controls and references were quietly measuring affordability
            // instead of their own subject. What the refusal itself does is
            // covered by unit tests over the real pricing functions.
            CREDIT_SIGNUP_GRANT: process.env.CREDIT_SIGNUP_GRANT || '5000',
            // Turns the reconcile route on so the suite can check who it lets in.
            CRON_SECRET: 'e2e_cron_secret',
          }
        : {}),
    },
  },
})
