import { expect, type Locator, type Page, test } from '@playwright/test'

const mode = process.env.GENNY_MODE ?? 'byok'

/** 8x8 opaque PNG. Real enough for the byte sniffer, small enough to inline. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
  'base64',
)

/**
 * A fresh board, which is where the dock now lives.
 *
 * There is one canvas per piece of work rather than one studio per modality, so
 * every test that needs the prompt needs a board to put the result on. A new one
 * each time keeps tests from seeing each other's nodes.
 */
async function openCanvas(page: Page): Promise<void> {
  await page.goto('/c')
  await page.getByRole('button', { name: 'New canvas' }).click()
  await page.waitForURL(/\/c\/[0-9a-f-]{36}/)
}

/** The board itself, so a node is never confused with a model picker option. */
function board(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Canvas' })
}

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
    await expect(page).toHaveURL(/\/c$/)
  })

  test('security headers are present on every response', async ({ request }) => {
    const headers = (await request.get('/')).headers()
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('nothing modal and no sidebar in the shell', async ({ page }) => {
    await openCanvas(page)
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
    await openCanvas(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('navigation stays reachable at every width', async ({ page }) => {
    await openCanvas(page)
    await expect(page.getByRole('link', { name: 'Canvases' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Assets' })).toBeVisible()
    await expect(page.locator('header nav')).toBeVisible()
  })
})

test.describe('the dock', () => {
  test('byok asks for a key before anything else', async ({ page }) => {
    test.skip(mode !== 'byok', 'saas mode uses the server key')
    await openCanvas(page)
    await expect(page.getByLabel('Paste your fal key to start')).toBeVisible()
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveCount(0)
  })

  test('byok refuses a key with whitespace in it', async ({ page, request }) => {
    test.skip(mode !== 'byok', 'saas mode uses the server key')
    await openCanvas(page)
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
    await openCanvas(page)
    await expect(page.getByLabel('Prompt', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Paste your fal key to start')).toHaveCount(0)
  })

  test('the model picker opens without covering the page', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
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
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('FLUX')
    await page.getByRole('option', { name: /FLUX/ }).first().click()

    // FLUX declares Steps and Guidance; Nano Banana declares Resolution.
    await expect(page.getByLabel('Steps')).toBeVisible()
    await expect(page.getByLabel('Resolution')).toHaveCount(0)
  })

  test('generate stays disabled until there is a prompt', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
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

    await openCanvas(page)
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

    await openCanvas(page)
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

    await openCanvas(page)
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

    await openCanvas(page)
    const prompt = await fillPrompt(page, 'a sketch of @ti')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('Escape')

    await expect(page.locator('#mention-list')).toHaveCount(0)
    await expect(prompt).toHaveValue('a sketch of @ti')
  })

  test('an email address does not open the mention list', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await fillPrompt(page, 'mail ege@fal.ai about it')
    await expect(page.locator('#mention-list')).toHaveCount(0)
  })
})

test.describe('serving media', () => {
  test('an asset is served from our own origin, not the bucket', async ({ page }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    const src = await page.locator('main img').first().getAttribute('src')
    // Relative: a url naming the bucket's host breaks the moment the studio is
    // opened over a LAN address, a tunnel, or with a bucket that is not public.
    expect(src).toMatch(/^\/api\/assets\/[0-9a-f-]{36}\/.+\.png$/)

    const response = await page.request.get(src as string)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
    expect(response.headers()['accept-ranges']).toBe('bytes')

    /*
     * Serving files from our own origin is only safe while nothing
     * script-executable can be stored, so the response says so itself rather
     * than relying on a property of the upload path three files away.
     */
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['content-security-policy']).toContain('sandbox')
    // The filename is what `download` saves as, so it carries the handle.
    expect(response.headers()['content-disposition']).toContain('tiny.png')
  })

  test('a stranger cannot read it, whatever the filename says', async ({ page, browser }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()
    const src = (await page.locator('main img').first().getAttribute('src')) as string

    const stranger = await browser.newContext()
    const response = await stranger.request.get(`${page.url().replace(/\/assets$/, '')}${src}`)
    expect(response.status()).toBe(404)
    await stranger.close()
  })

  test('a malformed id is refused before anything is looked up', async ({ request }) => {
    const response = await request.get('/api/assets/not-a-uuid/whatever.png')
    expect(response.status()).toBe(400)
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

    await openCanvas(page)
    await fillPrompt(page, 'a portrait of @')
    await expect(page.locator('#mention-list')).toBeVisible()

    const first = page.locator('#mention-list [role=option]').first()
    await expect(first).toContainText('@ayse')
    await expect(first).toContainText(/character, 2 images/)
  })

  test('Enter does not start a generation while an unmatched mention is open', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    const prompt = await fillPrompt(page, 'a portrait of @nothingmatchesthis')
    // Enter here used to fall through and start a paid generation.
    await prompt.press('Enter')
    await expect(prompt).toHaveValue('a portrait of @nothingmatchesthis')
    await expect(page.getByRole('list', { name: 'Generations' })).toHaveCount(0)
  })
})

test.describe('one dock over every modality', () => {
  test('the picker offers stills, clips and speech from the same box', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()

    // The three studios are gone. A board holds a still, the clip animated from
    // it and its voiceover, so one picker has to reach all of them.
    const options = page.getByRole('option')
    await expect(options.filter({ hasText: 'Nano Banana' }).first()).toBeVisible()
    await expect(options.filter({ hasText: 'Kling' }).first()).toBeVisible()
    await expect(options.filter({ hasText: 'ElevenLabs' }).first()).toBeVisible()
  })

  test('a board opens on an image model, not on whatever is first', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    // Merging the studios made this a real decision: the first featured model of
    // any modality was a text to speech endpoint, so the first prompt anyone
    // typed got read aloud instead of drawn.
    await expect(page.getByPlaceholder(/Describe the image/)).toBeVisible()
  })

  test('the controls follow the model, because a video is not a still', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await expect(page.getByLabel('Length')).toHaveCount(0)

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByRole('option', { name: /Kling/ }).first().click()
    await expect(page.getByLabel('Length')).toBeVisible()
  })

  test('choosing a speech model renames the box, since nobody describes a script', async ({
    page,
  }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page
      .getByRole('option', { name: /ElevenLabs/ })
      .first()
      .click()
    await expect(page.getByLabel('Voice')).toBeVisible()
    await expect(page.getByPlaceholder(/what should be said/)).toBeVisible()
  })
})

test.describe('the board', () => {
  test('a new canvas is empty and says what to do with it', async ({ page }) => {
    await openCanvas(page)
    await expect(board(page).getByRole('option')).toHaveCount(0)
    await expect(page.getByText(/Everything you make lands here/)).toBeVisible()
  })

  test('the canvas list shows what you made and links back into it', async ({ page }) => {
    await openCanvas(page)
    const url = page.url()

    await page.goto('/c')
    await expect(page.getByRole('heading', { name: 'Canvases' })).toBeVisible()
    const cards = page.getByRole('list', { name: 'Canvases' }).getByRole('listitem')
    await expect(cards.first()).toBeVisible()

    await cards.first().getByRole('link').click()
    await expect(page).toHaveURL(url)
  })

  test('zoom is a control, not a surprise, and it survives the round trip', async ({ page }) => {
    await openCanvas(page)
    await expect(page.getByText('100%')).toBeVisible()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.getByText('120%')).toBeVisible()

    // The viewport is debounced before it is written, so the wait is the point
    // of the test rather than an accident of it.
    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('120%')).toBeVisible()
  })

  test('the board keeps the page from scrolling behind it', async ({ page }) => {
    await openCanvas(page)
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }))
    expect(overflow.x).toBeLessThanOrEqual(1)
    expect(overflow.y).toBeLessThanOrEqual(1)
  })

  test('a canvas belonging to somebody else is not found', async ({ page }) => {
    // RLS scopes the read, so a stranger's board and a board that never existed
    // are the same answer. Telling them apart tells a stranger what exists.
    const response = await page.goto('/c/00000000-0000-4000-8000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('a canvas id that is not a uuid is refused too', async ({ page }) => {
    const response = await page.goto('/c/not-a-canvas')
    expect(response?.status()).toBe(404)
  })

  test('deleting a canvas takes it off the list', async ({ page }) => {
    await openCanvas(page)
    await page.goto('/c')
    const cards = page.getByRole('list', { name: 'Canvases' }).getByRole('listitem')
    const before = await cards.count()

    await cards.first().getByRole('button', { name: 'Delete' }).click()
    // No dialog: the button becomes the question, which is the house pattern.
    await expect(page.getByText(/Delete .* and everything on it\?/)).toBeVisible()
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    await expect(cards).toHaveCount(before - 1)
  })
})

test.describe('a generation that never reaches fal', () => {
  test.skip(mode !== 'saas', 'the dock needs credentials to render')

  test('says so, and leaves no rectangle behind', async ({ page }) => {
    await openCanvas(page)
    await fillPrompt(page, 'a smooth river stone')
    await page.getByRole('button', { name: /^Generate/ }).click()

    // The placeholder is written before the submit, so that it exists is not the
    // question; that it is taken back is. No request id came out of fal, so
    // nothing ran, and the board is for work rather than for failures to start it.
    await expect(page.locator('main [role="alert"]').first()).toBeVisible()
    await expect(board(page).getByRole('option')).toHaveCount(0)
  })

  test('gives the credits back too', async ({ page }) => {
    await openCanvas(page)
    const meter = page.getByRole('link', { name: /credits/ })
    const before = await meter.textContent()

    await fillPrompt(page, 'a smooth river stone')
    await page.getByRole('button', { name: /^Generate/ }).click()
    await expect(page.locator('main [role="alert"]').first()).toBeVisible()

    await page.reload()
    await expect(meter).toHaveText(before ?? '')
  })
})

test.describe('models that require a reference', () => {
  test('an editing model blocks generate until an image is mentioned', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)

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

    await openCanvas(page)
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
    await openCanvas(page)
    await fillPrompt(page, 'a quiet street at dawn')
    await expect(page.getByText(/Mention one with/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Generate/ })).toBeEnabled()
  })

  test('the picker lists every seeded model', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
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
    await openCanvas(page)
    await expect(page.getByText(/credits/)).toHaveCount(0)
  })

  test('byok prices the button in dollars', async ({ page }) => {
    test.skip(mode !== 'byok', 'credits only exist in saas mode')
    await openCanvas(page)
    // The key gate stands in front of the dock, so check what it says instead.
    await expect(page.getByLabel('Paste your fal key to start')).toBeVisible()
  })

  test('saas grants trial credits to a new visitor and shows them', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await openCanvas(page)
    // The topbar meter, not the dock's price: this is the balance itself.
    await expect(page.getByRole('link', { name: /[\d,]+ credits available/ })).toBeVisible()
  })

  test('saas prices the button in credits, not dollars', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await openCanvas(page)
    await fillPrompt(page, 'a quiet street at dawn')

    const generate = page.getByRole('button', { name: /^Generate/ })
    await expect(generate).toContainText(/\d+ cr$/)
    await expect(generate).not.toContainText('$')
  })

  test('the reserved amount only appears when something is held', async ({ page }) => {
    test.skip(mode !== 'saas', 'byok has no credits')
    await openCanvas(page)
    await expect(page.getByText(/reserved/)).toHaveCount(0)
  })
})

test.describe('accounts', () => {
  // A fresh address per run: the suite shares one database across projects.
  const address = () => `ada-${Math.random().toString(36).slice(2, 10)}@example.com`
  const PASSWORD = 'a decent passphrase'

  async function signUp(page: Page, email: string) {
    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
  }

  test('what you made before signing up is still yours after', async ({ page }) => {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await signUp(page, address())
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.goto('/assets')
    await expect(page.locator('ul.grid li').first()).toBeVisible()
  })

  test('signing back in finds the same work, which is the whole point', async ({ page }) => {
    const email = address()
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()
    await signUp(page, email)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()

    // Signed out, this browser is back to being a stranger.
    await page.goto('/assets')
    await expect(page.locator('ul.grid li')).toHaveCount(0)

    await page.goto('/signin')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.goto('/assets')
    await expect(page.locator('ul.grid li').first()).toBeVisible()
  })

  test('a wrong password says the same thing as an unknown email', async ({ page }) => {
    const email = address()
    await signUp(page, email)
    await page.getByRole('button', { name: 'Sign out' }).click()

    const messages: string[] = []
    for (const attempt of [
      { email, password: 'the wrong passphrase' },
      { email: address(), password: PASSWORD },
    ]) {
      await page.goto('/signin')
      await page.getByLabel('Email').fill(attempt.email)
      await page.getByLabel('Password').fill(attempt.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      messages.push(await page.locator('main [role=alert]').innerText())
    }
    expect(new Set(messages).size).toBe(1)
  })

  test('an email that already has an account cannot take it twice', async ({ page }) => {
    const email = address()
    await signUp(page, email)
    await page.getByRole('button', { name: 'Sign out' }).click()

    await signUp(page, email)
    await expect(page.locator('main [role=alert]')).toContainText('already has an account')
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
    await openCanvas(page)
    await page.getByRole('link', { name: /[\d,]+ credits available/ }).click()
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
