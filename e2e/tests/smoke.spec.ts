import { expect, test } from '@playwright/test'

const mode = process.env.GENNY_MODE ?? 'byok'

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
    await page.getByRole('button', { name: /Nano Banana 2$/ }).click()
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
    await page.getByRole('button', { name: /Nano Banana 2$/ }).click()
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
    await page.getByLabel('Prompt').fill('a quiet street at dawn')
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
    const card = page.locator('main ul li').first()
    await expect(card).toBeVisible()
    await expect(card.locator('p').first()).toHaveText(/^@[a-z0-9-]+$/)
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
    await expect(page.locator('main ul li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = page.getByLabel('Prompt')
    await prompt.fill('make it a sketch of @')
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
    await expect(page.locator('main ul li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = page.getByLabel('Prompt')
    await prompt.fill('@')
    await expect(page.locator('#mention-list')).toHaveAttribute('role', 'listbox')
    await expect(prompt).toHaveAttribute('aria-expanded', 'true')
    await expect(prompt).toHaveAttribute('aria-activedescendant', /mention-option-/)
  })

  test('arrow keys and Enter choose a mention without leaving the textarea', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('main ul li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = page.getByLabel('Prompt')
    await prompt.fill('a sketch of @')
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
    await expect(page.locator('main ul li').first()).toBeVisible()

    await page.goto('/image')
    const prompt = page.getByLabel('Prompt')
    await prompt.fill('a sketch of @ti')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('Escape')

    await expect(page.locator('#mention-list')).toHaveCount(0)
    await expect(prompt).toHaveValue('a sketch of @ti')
  })

  test('an email address does not open the mention list', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await page.goto('/image')
    await page.getByLabel('Prompt').fill('mail ege@fal.ai about it')
    await expect(page.locator('#mention-list')).toHaveCount(0)
  })
})
