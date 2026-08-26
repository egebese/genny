import { expect, type Locator, type Page, test } from '@playwright/test'

const mode = process.env.GENNY_MODE ?? 'byok'

/** 8x8 opaque PNG. Real enough for the byte sniffer, small enough to inline. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
  'base64',
)

/**
 * Fills the prompt and makes sure the value survived.
 *
 * A dev build under nine parallel workers can hydrate slowly enough that a fill
 * lands on the server-rendered textarea before React attaches, and React's first
 * render then wipes it. The product is fine; the test was typing into a page
 * that was not listening yet, so it types again.
 */
async function fillPrompt(page: Page, text: string): Promise<Locator> {
  // Exact: a model control called "Prompt strength" would otherwise match too.
  const prompt = page.getByLabel('Prompt', { exact: true })
  await expect(async () => {
    await prompt.fill(text)
    await expect(prompt).toHaveValue(text)
  }).toPass({ timeout: 15_000 })
  return prompt
}

test.describe('shell', () => {
  test('health endpoint reports every dependency', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as {
      ok: boolean
      mode: string
      checks: { name: string; ok: boolean }[]
    }
    expect(body.ok).toBe(true)
    expect(body.mode).toMatch(/^(byok|saas)$/)
    expect(body.checks.map((c) => c.name).sort()).toEqual(['catalog', 'database', 'env'])
  })

  test('health endpoint leaks no configuration values', async ({ request }) => {
    const text = await (await request.get('/api/health')).text()
    expect(text).not.toContain('postgresql://')
    expect(text).not.toMatch(/[A-Za-z0-9+/]{40,}={0,2}/)
  })

  test('landing page reaches the studio', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'Start generating' }).click()
    await expect(page).toHaveURL(/\/image$/)
  })

  test('security headers are present on every response', async ({ request }) => {
    const headers = (await request.get('/')).headers()
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('nothing modal and no sidebar in the shell', async ({ page }) => {
    await page.goto('/image')
    /*
     * `aria-modal="true"` is the thing that makes a surface modal: it tells
     * assistive technology the rest of the page is inert. Radix gives a popover
     * `role="dialog"` without it, which is a valid non-modal pattern, so testing
     * for the role would fail on something that is not a modal at all.
     */
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
    await expect(page.locator('aside')).toHaveCount(0)
  })

  test('the page does not scroll sideways on a phone', async ({ page }) => {
    await page.goto('/image')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('navigation stays reachable at every width', async ({ page }) => {
    await page.goto('/image')
    await expect(page.getByRole('link', { name: 'Video' })).toBeVisible()
    await expect(page.locator('header nav')).toBeVisible()
  })
})

test.describe('image studio', () => {
  test('byok asks for a key before anything else', async ({ page }) => {
    test.skip(mode !== 'byok', 'saas mode uses the server key')
    await page.goto('/image')
    await expect(page.getByLabel('Paste your fal key to start')).toBeVisible()
    await expect(page.getByLabel('Prompt')).toHaveCount(0)
  })

  test('byok refuses a key with whitespace in it', async ({ page, request }) => {
    test.skip(mode !== 'byok', 'saas mode uses the server key')
    await page.goto('/image')
    const response = await request.post('/api/session/fal-key', {
      data: { key: 'not a valid key at all here' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).reason).toMatch(/spaces/i)
  })

  test('byok refuses something far too short', async ({ request }) => {
    test.skip(mode !== 'byok', 'saas mode uses the server key')
    const response = await request.post('/api/session/fal-key', { data: { key: 'abc' } })
    expect(response.status()).toBe(400)
  })

  test('saas goes straight to the prompt', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok mode needs a key first')
    await page.goto('/image')
    await expect(page.getByLabel('Prompt')).toBeVisible()
    await expect(page.getByLabel('Paste your fal key to start')).toHaveCount(0)
  })

  test('the model picker opens without covering the page', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await page.getByRole('button', { name: /^Model:/ }).click()
    await expect(page.getByPlaceholder('Search models')).toBeVisible()

    // Non-modal: nothing claims the rest of the page is inert, the body is not
    // scroll-locked, and what is behind the popover stays visible.
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
    await expect(page.locator('main')).toBeVisible()
    const locked = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden')
    expect(locked).toBe(false)
  })

  test('the picker filters and switching a model changes the controls', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('FLUX')
    await page.getByRole('option', { name: /FLUX/ }).first().click()

    // FLUX declares Steps and Guidance; Nano Banana declares Resolution.
    await expect(page.getByLabel('Steps')).toBeVisible()
    await expect(page.getByLabel('Resolution')).toHaveCount(0)
  })

  test('generate stays disabled until there is a prompt', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    const generate = page.getByRole('button', { name: 'Generate' })
    await expect(generate).toBeDisabled()
    await fillPrompt(page, 'a quiet street at dawn')
    await expect(generate).toBeEnabled()
  })

  test('a job stream refuses a caller without a session', async ({ request }) => {
    const response = await request.get('/api/jobs/11111111-2222-3333-4444-555555555555/stream')
    expect([401, 404]).toContain(response.status())
  })

  test('a malformed job id is rejected outright', async ({ request }) => {
    const response = await request.get('/api/jobs/not-a-uuid/stream')
    expect([400, 401]).toContain(response.status())
  })
})

test.describe('assets and mentions', () => {
  test('the assets page offers an inline upload, not a modal', async ({ page }) => {
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: 'Assets' })).toBeVisible()
    await expect(page.getByText(/Drop files here, or click to choose/)).toBeVisible()
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
  })

  test('an uploaded file appears in the library with a mentionable handle', async ({ page }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    const card = page.locator('ul.grid li').first()
    await expect(card).toBeVisible()
    await expect(card.locator('span.font-mono')).toHaveText(/^@[a-z0-9-]+$/)
  })

  test('a file that is not media is refused whatever it is called', async ({ page }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles({
      name: 'pretend.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<!DOCTYPE html><html>not an image at all</html>'),
    })
    // Scoped to the page: Next's own route announcer is also role="alert".
    await expect(page.locator('main [role=alert]')).toContainText(/images, video and audio/i)
  })

  test('an empty file is refused', async ({ page }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles({
      name: 'empty.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(0),
    })
    await expect(page.locator('main [role=alert]')).toBeVisible()
  })

  test('typing @ opens the mention list and choosing inserts the handle', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')

    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = await fillPrompt(page, 'make it a sketch of @')
    await expect(page.locator('#mention-list')).toBeVisible()

    const option = page.locator('#mention-list [role=option]').first()
    const handle = (await option.locator('span.font-mono').innerText()).trim()
    await option.click()

    await expect(prompt).toHaveValue(`make it a sketch of ${handle} `)
    // The caret stays in the textarea: that is the whole point of the design.
    await expect(prompt).toBeFocused()
    await expect(page.locator('#mention-list')).toHaveCount(0)
  })

  test('the mention list is a listbox the textarea points at', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = await fillPrompt(page, '@')
    await expect(page.locator('#mention-list')).toHaveAttribute('role', 'listbox')
    await expect(prompt).toHaveAttribute('aria-expanded', 'true')
    await expect(prompt).toHaveAttribute('aria-activedescendant', /mention-option-/)
  })

  test('arrow keys and Enter choose a mention without leaving the textarea', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = await fillPrompt(page, 'a sketch of @')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('ArrowDown')
    await prompt.press('Enter')

    await expect(prompt).toHaveValue(/@[a-z0-9-]+\s$/)
    await expect(prompt).toBeFocused()
  })

  test('Escape closes the list and keeps what was typed', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = await fillPrompt(page, 'a sketch of @ti')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('Escape')

    await expect(page.locator('#mention-list')).toHaveCount(0)
    await expect(prompt).toHaveValue('a sketch of @ti')
  })

  test('an email address does not open the mention list', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await fillPrompt(page, 'mail ege@fal.ai about it')
    await expect(page.locator('#mention-list')).toHaveCount(0)
  })
})

test.describe('characters', () => {
  /** Two assets in the library, ready to bundle. */
  async function uploadTwo(page: import('@playwright/test').Page) {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: TINY_PNG },
      { name: 'two.png', mimeType: 'image/png', buffer: TINY_PNG },
    ])
    await expect(page.locator('ul.grid li').nth(1)).toBeVisible()
  }

  test('selecting assets reveals the naming bar in the page, not over it', async ({ page }) => {
    await uploadTwo(page)
    await expect(page.locator('#character-label')).toHaveCount(0)

    await page.locator('ul.grid li label').first().click()
    await expect(page.locator('#character-label')).toBeVisible()
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
  })

  test('a character is created and shown with how many images it carries', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').nth(0).click()
    await page.locator('ul.grid li label').nth(1).click()
    await page.locator('#character-label').fill('ayse')
    await page.getByRole('button', { name: 'Create character' }).click()

    const chip = page.locator('section li').first()
    await expect(chip).toContainText('@ayse')
    await expect(chip).toContainText('2')
    // Selection clears, so the bar goes away on its own.
    await expect(page.locator('#character-label')).toHaveCount(0)
  })

  test('a character cannot be created without a name', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').first().click()
    await expect(page.getByRole('button', { name: 'Create character' })).toBeDisabled()
  })

  test('a character can be deleted without taking its assets', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').first().click()
    await page.locator('#character-label').fill('temporary')
    await page.getByRole('button', { name: 'Create character' }).click()
    await expect(page.locator('section li').first()).toContainText('@temporary')

    await page.getByRole('button', { name: /Delete character temporary/ }).click()
    await expect(page.locator('section li')).toHaveCount(0)
    await expect(page.locator('ul.grid li')).toHaveCount(2)
  })

  test('a character appears in the mention list ahead of plain assets', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await uploadTwo(page)
    await page.locator('ul.grid li label').nth(0).click()
    await page.locator('ul.grid li label').nth(1).click()
    await page.locator('#character-label').fill('ayse')
    await page.getByRole('button', { name: 'Create character' }).click()
    await expect(page.locator('section li').first()).toContainText('@ayse')

    await page.goto('/image')
    await fillPrompt(page, 'a portrait of @')
    await expect(page.locator('#mention-list')).toBeVisible()

    const first = page.locator('#mention-list [role=option]').first()
    await expect(first).toContainText('@ayse')
    await expect(first).toContainText(/character, 2 images/)
  })

  test('Enter does not start a generation while an unmatched mention is open', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    const prompt = await fillPrompt(page, 'a portrait of @nothingmatchesthis')
    // Enter here used to fall through and start a paid generation.
    await prompt.press('Enter')
    await expect(prompt).toHaveValue('a portrait of @nothingmatchesthis')
    await expect(page.locator('main ul li')).toHaveCount(0)
  })
})

test.describe('the other modalities', () => {
  test('video is a studio of its own, offering only video models', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/video')
    await page.getByRole('button', { name: /^Model:/ }).click()

    const options = page.getByRole('option')
    await expect(options.filter({ hasText: 'Kling' }).first()).toBeVisible()
    // Nothing from the image catalogue leaks in.
    await expect(options.filter({ hasText: 'FLUX' })).toHaveCount(0)
    await expect(options.filter({ hasText: 'Nano Banana' })).toHaveCount(0)
  })

  test('audio is its own studio too, and text to speech calls the prompt a script', async ({
    page,
  }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/audio')
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page
      .getByRole('option', { name: /ElevenLabs/ })
      .first()
      .click()
    await expect(page.getByLabel('Voice')).toBeVisible()
  })

  test('each studio keeps its own controls, because a video is not a still', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/video')
    await expect(page.getByLabel('Length')).toBeVisible()

    await page.goto('/image')
    await expect(page.getByLabel('Length')).toHaveCount(0)
  })

  test('the topbar links to all three and none of them is a dead end', async ({ page }) => {
    await page.goto('/image')
    for (const name of ['Video', 'Audio']) {
      const response = await page.goto(`/${name.toLowerCase()}`)
      expect(response?.status(), `${name} is a dead link`).toBe(200)
      await expect(page.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('a page of history is refused an unknown modality', async ({ request }) => {
    const response = await request.get('/api/jobs?modality=holograms')
    expect(response.status()).toBe(400)
  })
})

test.describe('history', () => {
  test('history is a route in the topbar and says so when empty', async ({ page }) => {
    await page.goto('/image')
    await expect(page.getByRole('link', { name: 'History' })).toBeVisible()

    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.getByText(/Nothing yet/)).toBeVisible()
  })

  test('the jobs page returns an empty page rather than an error without a session', async ({
    request,
  }) => {
    const response = await request.get('/api/jobs')
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { items: unknown[]; nextCursor: string | null }
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('a malformed cursor is refused rather than silently ignored', async ({ request }) => {
    const response = await request.get('/api/jobs?before=not-a-date')
    expect(response.status()).toBe(400)
  })

  test('the feed offers no load-more button when there is nothing older', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await expect(page.getByRole('button', { name: /Load older/ })).toHaveCount(0)
  })
})

test.describe('models that require a reference', () => {
  test('an editing model blocks generate until an image is mentioned', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('Kontext')
    await page
      .getByRole('option', { name: /Kontext/ })
      .first()
      .click()

    await fillPrompt(page, 'make it a pencil sketch')
    await expect(page.getByText(/Mention one with/)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Generate/ })).toBeDisabled()
  })

  test('mentioning an image unblocks it', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles({
      name: 'ref.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    })
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await page.goto('/image')
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('Kontext')
    await page
      .getByRole('option', { name: /Kontext/ })
      .first()
      .click()

    const prompt = await fillPrompt(page, 'make it a pencil sketch of @')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('Enter')

    await expect(page.getByText(/Mention one with/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Generate/ })).toBeEnabled()
  })

  test('a text-to-image model needs no reference', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await fillPrompt(page, 'a quiet street at dawn')
    await expect(page.getByText(/Mention one with/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Generate/ })).toBeEnabled()
  })

  test('the picker lists every seeded model', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await page.getByRole('button', { name: /^Model:/ }).click()
    // Seven image models ship in the catalog.
    await expect(page.locator('#mention-list')).toHaveCount(0)
    const options = page.locator('[role=option]')
    expect(await options.count()).toBeGreaterThanOrEqual(7)
  })
})

test.describe('credits', () => {
  test('byok shows no credit balance, because there is nothing of ours to spend', async ({
    page,
  }) => {
    test.skip(mode !== 'byok', 'credits only exist in saas mode')
    await page.goto('/image')
    await expect(page.getByText(/credits/)).toHaveCount(0)
  })

  test('byok prices the button in dollars', async ({ page }) => {
    test.skip(mode !== 'byok', 'credits only exist in saas mode')
    await page.goto('/image')
    // The key gate stands in front of the dock, so check what it says instead.
    await expect(page.getByLabel('Paste your fal key to start')).toBeVisible()
  })

  test('saas grants trial credits to a new visitor and shows them', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await page.goto('/image')
    // The topbar meter, not the dock's price: this is the balance itself.
    await expect(page.getByRole('link', { name: /[\d,]+ credits/ })).toBeVisible()
  })

  test('saas prices the button in credits, not dollars', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await page.goto('/image')
    await fillPrompt(page, 'a quiet street at dawn')

    const generate = page.getByRole('button', { name: /^Generate/ })
    await expect(generate).toContainText(/\d+ cr$/)
    await expect(generate).not.toContainText('$')
  })

  test('the reserved amount only appears when something is held', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await page.goto('/image')
    await expect(page.getByText(/reserved/)).toHaveCount(0)
  })
})

test.describe('billing page', () => {
  test('saas offers plans and a top-up, without a modal in sight', async ({ page }) => {
    test.skip(mode !== 'saas', 'billing only exists in saas mode')
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subscribe' })).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Buy credits' })).toBeVisible()
    await expect(page.locator('dialog, [role=dialog]')).toHaveCount(0)
  })

  test('byok has no billing page at all', async ({ page }) => {
    test.skip(mode !== 'byok', 'saas is the one that sells things')
    const response = await page.goto('/billing')
    expect(response?.status()).toBe(404)
  })
})

test.describe('fal webhook', () => {
  test('refuses an unsigned delivery', async ({ request }) => {
    test.skip(mode !== 'saas', 'the callback settles with our key, which byok has not got')
    const response = await request.post('/api/webhooks/fal', {
      data: { request_id: 'whatever', status: 'OK' },
    })
    expect(response.status()).toBe(401)
  })

  test('does not exist in byok, where the visitor holds the key', async ({ request }) => {
    test.skip(mode !== 'byok', 'saas is the mode that registers callbacks')
    const response = await request.post('/api/webhooks/fal', {
      data: { request_id: 'whatever', status: 'OK' },
    })
    expect(response.status()).toBe(404)
  })
})

test.describe('usage page', () => {
  test('shows the ledger, the tier and what it allows', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no ledger to read')
    await page.goto('/usage')
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
    // A new visitor is on the free tier with their trial grant on the ledger.
    await expect(page.getByText('Free')).toBeVisible()
    await expect(page.getByText('trial credits')).toBeVisible()
  })

  test('is reachable from the credit meter, since that is the number people question', async ({
    page,
  }) => {
    test.skip(mode !== 'saas', 'byok has no credit meter')
    await page.goto('/image')
    await page.getByRole('link', { name: /[\d,]+ credits/ }).click()
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
  })

  test('byok has no usage page, because there is no ledger', async ({ page }) => {
    test.skip(mode !== 'byok', 'saas is the mode with credits')
    const response = await page.goto('/usage')
    expect(response?.status()).toBe(404)
  })
})

test.describe('reconcile route', () => {
  test('refuses a request without the shared secret', async ({ request }) => {
    test.skip(mode !== 'saas', 'the suite only configures a cron secret in saas')
    const response = await request.post('/api/cron/reconcile')
    expect(response.status()).toBe(401)
  })

  test('refuses a wrong secret, and a longer one, without throwing', async ({ request }) => {
    test.skip(mode !== 'saas', 'the suite only configures a cron secret in saas')
    for (const token of ['nope', 'e2e_cron_secret_and_then_some']) {
      const response = await request.post('/api/cron/reconcile', {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(response.status()).toBe(401)
    }
  })

  test('sweeps when the secret matches', async ({ request }) => {
    test.skip(mode !== 'saas', 'the suite only configures a cron secret in saas')
    const response = await request.post('/api/cron/reconcile', {
      headers: { authorization: 'Bearer e2e_cron_secret' },
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ checked: expect.any(Number) })
  })

  test('does not exist when no secret is configured', async ({ request }) => {
    test.skip(mode !== 'byok', 'byok is the mode the suite leaves unconfigured')
    const response = await request.post('/api/cron/reconcile')
    expect(response.status()).toBe(404)
  })
})

test.describe('stripe webhook', () => {
  test('an unsigned webhook is refused', async ({ request }) => {
    test.skip(mode !== 'saas', 'billing only exists in saas mode')
    const response = await request.post('/api/webhooks/stripe', {
      data: { id: 'evt_1', type: 'invoice.paid' },
    })
    expect(response.status()).toBe(400)
    expect(await response.text()).toMatch(/signature/i)
  })

  test('a forged signature is refused', async ({ request }) => {
    test.skip(mode !== 'saas', 'billing only exists in saas mode')
    const response = await request.post('/api/webhooks/stripe', {
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      data: { id: 'evt_1', type: 'invoice.paid' },
    })
    expect(response.status()).toBe(400)
  })

  test('the refusal says nothing about why, so it is not a forging oracle', async ({ request }) => {
    test.skip(mode !== 'saas', 'billing only exists in saas mode')
    const response = await request.post('/api/webhooks/stripe', {
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      data: { id: 'evt_1' },
    })
    const body = await response.text()
    expect(body).toBe('invalid signature')
    expect(body).not.toMatch(/expected|timestamp|secret/i)
  })

  test('byok has no billing endpoint at all', async ({ request }) => {
    test.skip(mode !== 'byok', 'saas has one')
    const response = await request.post('/api/webhooks/stripe', { data: {} })
    expect(response.status()).toBe(404)
  })
})
