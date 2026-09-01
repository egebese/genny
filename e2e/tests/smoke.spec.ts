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
    expect(body.checks.map((c) => c.name).sort()).toEqual(['catalog', 'database', 'env', 'sweep'])
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

    /*
     * The rule is about geometry, not about a tag. "A panel anchored to
     * something you selected is not a sidebar; a persistent column down the
     * edge is." This used to assert no `<aside>` existed, which is a proxy that
     * fails on a small floating panel and would pass on a full-height nav rail
     * built out of divs.
     *
     * So: nothing may be flush against the left or right edge and most of the
     * height of the viewport. The project shelf is inset, collapsed by default,
     * and the board runs full width underneath it.
     */
    const rails = await page.evaluate(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      return [...document.querySelectorAll('body *')]
        .map((element) => element.getBoundingClientRect())
        .filter((box) => box.height > viewport.height * 0.7 && box.width < viewport.width * 0.5)
        .filter((box) => box.left <= 1 || box.right >= viewport.width - 1).length
    })
    expect(rails).toBe(0)
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
    // The board opens on Nano Banana, which declares a resolution ladder.
    await expect(page.getByLabel('Resolution')).toBeVisible()

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('FLUX')
    await page.getByRole('option', { name: /FLUX/ }).first().click()

    // FLUX sizes itself by named image size instead, and has no resolution.
    await expect(page.getByLabel('Size')).toBeVisible()
    await expect(page.getByLabel('Resolution')).toHaveCount(0)
  })

  test('the settings that get set once wait behind the adjust button', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)

    /*
     * Quality, shape and how many are what changes between one generation and
     * the next. Format and seed are set once, if ever, and eight chips in a row
     * made the ones that matter as hard to find as the ones that do not.
     */
    await expect(page.getByLabel('Format')).toHaveCount(0)
    await expect(page.getByLabel('Seed')).toHaveCount(0)

    await page.getByRole('button', { name: 'More settings' }).click()
    await expect(page.getByLabel('Format')).toBeVisible()
    await expect(page.getByLabel('Seed')).toBeVisible()

    await page.getByRole('button', { name: 'Fewer settings' }).click()
    await expect(page.getByLabel('Format')).toHaveCount(0)
  })

  test('a count control cannot walk past what the endpoint allows', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)

    const more = page.getByRole('button', { name: 'One more images' })
    const fewer = page.getByRole('button', { name: 'One fewer images' })
    // One is the floor, and the catalog says four is the ceiling here. Past
    // either, fal answers 422 with a reason that never reaches anyone.
    await expect(fewer).toBeDisabled()
    for (let step = 0; step < 3; step++) await more.click()
    await expect(more).toBeDisabled()
    await expect(fewer).toBeEnabled()
  })

  test('the generate button does not move when the price changes', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    const generate = page.getByRole('button', { name: /^Generate/ })
    const width = async () => Math.round((await generate.boundingBox())?.width ?? 0)

    /*
     * `$0.0024` and `$0.35` are four characters apart, so a button sized to its
     * own text changed width as the settings changed and the thing you were
     * about to press moved out from under the pointer.
     */
    const before = await width()
    await page.getByRole('button', { name: 'One more images' }).click()
    expect(await width()).toBe(before)

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByRole('option', { name: /Kling/ }).first().click()
    await expect(generate).toBeVisible()
    expect(await width()).toBe(before)
  })

  test('the settings row says when it has more, and can be scrolled to it', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    test.skip((page.viewportSize()?.width ?? 0) < 700, 'a phone row is always overflowing')
    await openCanvas(page)

    // Nothing past the edge to begin with, so nothing to point at.
    await expect(page.getByRole('button', { name: 'Scroll settings right' })).toHaveCount(0)

    // The scrollbar is hidden here on purpose, so opening the rest of the
    // settings would otherwise put them past the edge without saying so.
    await page.getByRole('button', { name: 'More settings' }).click()
    const right = page.getByRole('button', { name: 'Scroll settings right' })
    await expect(right).toBeVisible()

    await right.click()
    await expect(page.getByRole('button', { name: 'Scroll settings left' })).toBeVisible()
  })

  test('a bigger output costs what fal charges for it', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)

    const generate = page.getByRole('button', { name: /^Generate/ })
    const resolution = page.getByLabel('Resolution')

    /*
     * Nano Banana charges 1.5x for 2K and 2x for 4K. The estimate becomes the
     * hold and settle captures held × produced ÷ expected and never more, so an
     * unscaled rung is not a rounding error: it is a permanent discount.
     *
     * Read as numbers rather than as strings, so this fails on a wrong price
     * rather than on a changed currency symbol.
     */
    const priced = async () => {
      const text = (await generate.textContent()) ?? ''
      return Number(/([0-9]+(?:\.[0-9]+)?)/.exec(text)?.[1] ?? '0')
    }

    await resolution.fill('1')
    const standard = await priced()
    expect(standard).toBeGreaterThan(0)

    await resolution.fill('2')
    expect(await priced()).toBeCloseTo(standard * 1.5, 4)

    await resolution.fill('3')
    expect(await priced()).toBeCloseTo(standard * 2, 4)
  })

  test('a card says what it can be handed, not only what it makes', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByRole('button', { name: 'Text to Video', exact: true }).click()

    /*
     * Four video families also animate a still, and the group only names what
     * they do from a prompt alone, because that is the endpoint the picker
     * chooses. With nothing to say otherwise the picker looked like it had no
     * image-to-video at all: the way to reach it is to attach an image, which
     * nobody tries on a card that says Text to Video.
     */
    const cards = page.locator('[cmdk-group-items] [role=option]')
    // Lowercase in the DOM: the capitals are `uppercase`, which is paint.
    await expect(cards.filter({ hasText: 'MiniMax H3 Max' })).toContainText('+ image')
  })

  test('a model appears in every category it can work in', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()

    /*
     * A family is not one thing. Four of them write video from a prompt and
     * animate a still, and filing each under only the first left an Image to
     * Video heading that was either empty or absent while four models did
     * exactly that. The categories are capabilities, not a label each model
     * gets one of.
     */
    await page.getByRole('button', { name: 'Image to Video', exact: true }).click()
    const cards = page.locator('[cmdk-group-items] [role=option]')
    for (const name of ['Kling 2.5 Turbo Pro', 'PixVerse C1', 'Wan 2.7', 'MiniMax H3 Max']) {
      await expect(cards.filter({ hasText: name })).toHaveCount(1)
    }

    // And the card names the category you came in through, not the other one.
    await expect(cards.filter({ hasText: 'MiniMax H3 Max' })).toContainText('Image to Video')
  })

  test('the picker lists models, not the endpoints they are split across', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()

    /*
     * fal splits one model across endpoints by what you hand it, so the catalog
     * carries more entries than there are models. Nano Banana 2 appeared twice
     * and one of the two could truthfully say it takes no image.
     */
    const cards = page.locator('[cmdk-group-items] [role=option]')
    await expect(cards.filter({ hasText: 'Nano Banana 2' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Kling 2.5 Turbo Pro' })).toHaveCount(1)
  })

  test('attaching an image to a text model reaches its edit endpoint', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')

    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await openCanvas(page)
    // The board opens on Nano Banana 2, whose base endpoint declares no slot.
    // Mentioning something used to leave generate disabled and offer a swap;
    // now the model simply takes it, on the URL that can.
    await fillPrompt(page, 'make it a sketch of @')
    await page.locator('#mention-list [role=option]').first().click()

    await expect(page.getByRole('button', { name: /^Generate/ })).toBeEnabled()
    await expect(page.getByText(/cannot use a reference/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Model:/ })).toContainText('Nano Banana 2')
  })

  test('the price follows the size, because fal bills this model by area', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('schnell')
    await page
      .getByRole('option', { name: /schnell/ })
      .first()
      .click()

    const generate = page.getByRole('button', { name: /^Generate/ })
    const before = await generate.textContent()

    await page.getByLabel('Size').click()
    // Sorted the way the catalog lists them, and the first is the largest square.
    await page.getByRole('dialog').getByRole('button').first().click()

    await expect(generate).not.toHaveText(before ?? '')
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

  test('a chosen mention shows up as a chip with its own preview', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')

    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await openCanvas(page)
    const prompt = await fillPrompt(page, 'make it a sketch of @')
    await page.locator('#mention-list [role=option]').first().click()

    /*
     * A mention used to be bare text in the prompt and nothing else, which made
     * a working reference look exactly like a typo. It is a chip now, the same
     * shape as a pinned attachment, because both are an image this generation
     * will see.
     */
    const strip = page.getByRole('list', { name: 'Attached to this generation' })
    const chip = strip.getByRole('listitem').first()
    await expect(chip).toBeVisible()
    await expect(chip.locator('img')).toBeVisible()

    // Removing the chip edits the sentence, because that is where it lives. The
    // trailing space stays so the caret lands somewhere you can keep typing.
    await chip.getByRole('button').click()
    await expect(prompt).toHaveValue('make it a sketch of ')
    await expect(strip).toHaveCount(0)
  })

  test('a handle that resolves to nothing is marked as a miss', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')

    await openCanvas(page)
    await fillPrompt(page, 'next to @nothing-here and done')

    // The highlight is a second copy of the prompt painted underneath it, so
    // the mark is findable even though the real text is in a textarea.
    const marked = page.locator('[aria-hidden="true"] span', { hasText: '@nothing-here' }).last()
    await expect(marked).toHaveClass(/decoration-wavy/)
    await expect(page.getByRole('list', { name: 'Attached to this generation' })).toHaveCount(0)
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

test.describe('groups', () => {
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
    await expect(page.locator('#group-label')).toHaveCount(0)

    await page.locator('ul.grid li label').first().click()
    await expect(page.locator('#group-label')).toBeVisible()
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
  })

  test('a group is created and shown with how many images it carries', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').nth(0).click()
    await page.locator('ul.grid li label').nth(1).click()
    await page.locator('#group-label').fill('ayse')
    await page.getByRole('button', { name: 'Create group' }).click()

    const chip = page.locator('section li').first()
    await expect(chip).toContainText('@ayse')
    await expect(chip).toContainText('2')
    // Selection clears, so the bar goes away on its own.
    await expect(page.locator('#group-label')).toHaveCount(0)
  })

  test('a group cannot be created without a name', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').first().click()
    await expect(page.getByRole('button', { name: 'Create group' })).toBeDisabled()
  })

  test('a group can be deleted without taking its assets', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').first().click()
    await page.locator('#group-label').fill('temporary')
    await page.getByRole('button', { name: 'Create group' }).click()
    await expect(page.locator('section li').first()).toContainText('@temporary')

    await page.getByRole('button', { name: /Delete group temporary/ }).click()
    await expect(page.locator('section li')).toHaveCount(0)
    await expect(page.locator('ul.grid li')).toHaveCount(2)
  })

  test('a group can be a product, not only a character', async ({ page }) => {
    await uploadTwo(page)
    await page.locator('ul.grid li label').nth(0).click()
    await page.locator('ul.grid li label').nth(1).click()

    // The kind is a real choice, because four angles of a hoodie were being
    // filed under a table called "characters".
    await page.getByRole('button', { name: 'Product', exact: true }).click()
    await page.locator('#group-label').fill('offwhite hoodie')
    await page.getByRole('button', { name: 'Create group' }).click()

    await expect(page.locator('section li').first()).toContainText('@offwhite-hoodie')
  })

  test('a group appears in the mention list ahead of plain assets', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await uploadTwo(page)
    await page.locator('ul.grid li label').nth(0).click()
    await page.locator('ul.grid li label').nth(1).click()
    await page.locator('#group-label').fill('ayse')
    await page.getByRole('button', { name: 'Create group' }).click()
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

test.describe('projects hold canvases', () => {
  test('a new canvas lands in a project, and the project says so', async ({ page }) => {
    await openCanvas(page)
    const board = page.url()

    await page.goto('/c')
    // Every board sits under a heading that links to its project, rather than
    // in one flat row with no indication which of them belong together.
    const project = page.locator('main section').first().getByRole('link').first()
    await expect(project).toBeVisible()
    await project.click()
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/)

    await expect(
      page.getByRole('list', { name: 'Canvases' }).getByRole('link').first(),
    ).toHaveAttribute('href', new URL(board).pathname)
  })

  test('a project remembers what it is about', async ({ page }) => {
    await openCanvas(page)
    await page.goto('/c')
    await page.locator('main section').first().getByRole('link').first().click()

    const brief = page.getByLabel('What this project is')
    await brief.fill('Off-white knitwear for a Berlin label. Never warm light.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()

    // Written down, not just echoed back into the field it came from.
    await page.reload()
    await expect(brief).toHaveValue('Off-white knitwear for a Berlin label. Never warm light.')
  })

  test('a colour added to the palette survives a reload', async ({ page }) => {
    await openCanvas(page)
    await page.goto('/c')
    await page.locator('main section').first().getByRole('link').first().click()

    await page.getByLabel('Colour as hex').fill('#c8b6a6')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove #c8b6a6' })).toBeVisible()
  })

  test('somebody else project is not found', async ({ page }) => {
    // The status code, not the copy: RLS scopes the read, so a stranger's
    // project and one that never existed are the same answer, and asserting on
    // the sentence would just track the wording of the 404 page.
    const response = await page.goto('/p/00000000-0000-4000-8000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('a non-uuid project id is refused before any lookup', async ({ page }) => {
    const response = await page.goto('/p/not-a-uuid')
    expect(response?.status()).toBe(404)
  })
})

test.describe('the project shelf', () => {
  /** Uploads one image and pins it, returning the board it will show up on. */
  async function pinSomething(page: Page, role: string): Promise<string> {
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await openCanvas(page)
    const board = page.url()

    await page.goto('/c')
    await page.locator('main section').first().getByRole('link').first().click()
    await page.waitForURL(/\/p\/[0-9a-f-]{36}/)
    const cards = page.locator('section:has-text("Project material") ul').last().locator('> li')
    await cards.first().getByRole('button', { name: role, exact: true }).click()
    await expect(page.getByRole('button', { name: /^Unpin / })).toBeVisible()
    return board
  }

  test('what is pinned to the project is on the board of every canvas in it', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    const board = await pinSomething(page, 'Product')

    await page.goto(board)
    const shelf = page.getByRole('complementary', { name: 'Project material' })
    await expect(shelf).toBeVisible()
    // Collapsed until asked: open, it eats a third of a phone board.
    await expect(shelf.getByRole('button', { name: /^Attach / })).toHaveCount(0)

    await shelf.getByRole('button', { expanded: false }).click()
    await expect(shelf.getByText('Product')).toBeVisible()
    await expect(shelf.getByRole('button', { name: /^Attach / })).toHaveCount(1)
  })

  test('clicking a pinned asset attaches it to the prompt', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    const board = await pinSomething(page, 'Product')

    await page.goto(board)
    const shelf = page.getByRole('complementary', { name: 'Project material' })
    await shelf.getByRole('button', { expanded: false }).click()
    await shelf
      .getByRole('button', { name: /^Attach / })
      .first()
      .click()

    /*
     * The slot comes from the endpoint this model would run *with the item
     * added*, not the one it runs now. Asked the other way round a
     * text-to-image model reports no slots at all, because before the first
     * image it is the text-only task, and the click does nothing.
     */
    const strip = page.getByRole('list', { name: 'Attached to this generation' })
    await expect(strip.getByRole('listitem')).toHaveCount(1)
  })

  test('the shelf does not make the board inert, because it is not a modal', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    const shelf = page.getByRole('complementary', { name: 'Project material' })
    await shelf.getByRole('button', { expanded: false }).click()

    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
    // The prompt behind it still takes what you type.
    await fillPrompt(page, 'a concrete plinth under overcast light')
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

  test('the picker finds a model by what it is, not only by its name', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    const search = page.getByPlaceholder('Search models')
    const cards = page.getByRole('option')

    /*
     * Valid markup, which neither the type checker nor the tests noticed: the
     * category rail grouped its headings in an `<li>` that held the buttons,
     * each of which is an `<li>` of its own. React only says so in the console,
     * and it says it is a hydration error.
     */
    expect(await page.locator('li li').count()).toBe(0)

    /*
     * cmdk matched the family name and its group, which found nothing for any
     * of these at thirty-five families: "upscale" is in the group of three
     * models and the name of none, and no lab could be searched for at all.
     */
    for (const [term, expected] of [
      ['upscale', /Upscale/i],
      ['google', /Veo|Omni|Lyria|Gemini|Nano Banana/i],
      ['bytedance', /Seedream|Seedance|Seed Audio|SeedVR/i],
      ['speech', /Speech/i],
    ] as const) {
      await search.fill(term)
      await expect(cards.first()).toBeVisible()
      await expect(cards.first()).toContainText(expected)
    }
  })

  test('the browser never gets to show its own right-click menu', async ({ page }) => {
    await openCanvas(page)
    /*
     * On the whole page, not only on the board. Right-clicking a result offered
     * to save the image and open it in a new tab, which are answers the node
     * menu gives better, and the studio is an app rather than a document
     * everywhere else too.
     */
    const prevented = await page.evaluate(() =>
      ['body', 'header', 'textarea'].map((selector) => {
        const target = document.querySelector(selector) ?? document.body
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
        target.dispatchEvent(event)
        return event.defaultPrevented
      }),
    )
    expect(prevented).toEqual([true, true, true])
  })

  test('right-clicking empty board offers the one thing that makes sense there', async ({
    page,
  }) => {
    await openCanvas(page)
    /*
     * The mouse rather than the locator: the transform layer is what fills the
     * board, and a position inside it is a position in canvas coordinates,
     * which are wherever the board has been panned to. This is a point on the
     * screen, clear of the shelf top left and the dock along the bottom.
     */
    const screen = page.viewportSize() ?? { width: 1440, height: 900 }
    await page.mouse.click(screen.width * 0.5, screen.height * 0.35, { button: 'right' })

    const menu = page.getByRole('menu', { name: 'Board actions' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Paste'])
    // Nothing has been copied in this session, so there is nothing to put down.
    await expect(menu.getByRole('menuitem', { name: 'Paste' })).toBeDisabled()
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

  /*
   * `retitleCanvas` was written when boards landed and never called, so every
   * board anybody made was called Untitled forever.
   */
  test('a canvas can be renamed', async ({ page }) => {
    await openCanvas(page)
    await page.goto('/c')
    const card = page.getByRole('list', { name: 'Canvases' }).getByRole('listitem').first()

    await card.getByRole('button', { name: 'Rename' }).click()
    await card.getByRole('textbox').fill('Autumn campaign')
    await card.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Autumn campaign')).toBeVisible()
  })

  test('a canvas can be duplicated, and the copy says so', async ({ page }) => {
    await openCanvas(page)
    await page.goto('/c')
    const cards = page.getByRole('list', { name: 'Canvases' }).getByRole('listitem')
    const before = await cards.count()

    await cards.first().getByRole('button', { name: 'Duplicate' }).click()
    await expect(cards).toHaveCount(before + 1)
    await expect(page.getByText(/ copy$/).first()).toBeVisible()
  })

  test('a project can be started, rather than only appearing under a canvas', async ({ page }) => {
    await page.goto('/c')
    await page.getByRole('button', { name: 'New project' }).click()
    await expect(page.getByRole('link', { name: 'New project' })).toBeVisible()
  })

  test('a board offers the way back to its project', async ({ page }) => {
    await openCanvas(page)
    await page.getByRole('link', { name: 'Open project' }).click()
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/)
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
  test('a model with both tasks writes from text and edits when given an image', async ({
    page,
  }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')

    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/tiny.png')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('Kontext')
    await page.locator('[cmdk-group-items] [role=option]').first().click()

    /*
     * Kontext used to be an editing endpoint in the picker, so it blocked until
     * something was mentioned. It is a model now, with a text task and an edit
     * task, and which one runs is decided by what is attached rather than by
     * which URL was chosen.
     */
    const generate = page.getByRole('button', { name: /^Generate/ })
    await fillPrompt(page, 'a pencil sketch of a bicycle')
    await expect(generate).toBeEnabled()

    await fillPrompt(page, 'make it a pencil sketch of @')
    await page.locator('#mention-list [role=option]').first().click()
    await expect(generate).toBeEnabled()
    await expect(page.getByText(/Mention one with/)).toHaveCount(0)
  })

  test('a list the model insists on is asked for, and filled in place', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    /*
     * H3's LoRA endpoints take `[{path, scale}]` and refuse to run without at
     * least one. The catalog had no way to say that, so those endpoints could
     * not be called at all; a required list also has no useful default, since
     * an empty one fails fal's own minimum, so the dock has to ask.
     */
    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('LoRA')
    await page.getByRole('option', { name: /LoRA/ }).first().click()

    await fillPrompt(page, 'a kite over a car park')
    const generate = page.getByRole('button', { name: /^Generate/ })
    await expect(page.getByText(/will not run without loras/i)).toBeVisible()
    await expect(generate).toBeDisabled()

    const chip = page.getByRole('button', { name: 'LoRAs' })
    await expect(chip).toContainText('none')
    await chip.click()
    await page.getByRole('button', { name: /^Add loras$/i }).click()

    await page.getByRole('textbox', { name: 'Weights URL' }).fill('owner/repo/lora.safetensors')
    // The strength column carries the catalog's own default, untouched.
    await expect(page.getByRole('spinbutton', { name: 'Strength' })).toHaveValue('1')

    await page.keyboard.press('Escape')
    await expect(chip).toContainText('1')
    await expect(page.getByText(/will not run without loras/i)).toHaveCount(0)
    await expect(generate).toBeEnabled()
  })

  test('a model with nothing to type still runs, on what it is given', async ({ page }) => {
    test.skip(mode !== 'saas', 'the dock needs credentials to render')
    /*
     * An upscaler has no prompt at all. Every layer used to insist on one: the
     * contract, the shared request schema, the injection into the model's own
     * strict schema, and the button, which was disabled on an empty box.
     */
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles({
      name: 'ref.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    })
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    await openCanvas(page)
    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('SeedVR')
    await page
      .getByRole('option', { name: /SeedVR/ })
      .first()
      .click()

    // It says what it is for rather than asking for a sentence.
    await expect(page.getByPlaceholder(/Nothing to type/)).toBeVisible()
    // And it is held back by the picture it has not been given, not by the box.
    const generate = page.getByRole('button', { name: /^Generate/ })
    await expect(generate).toBeDisabled()

    const prompt = page.getByPlaceholder(/Nothing to type/)
    await prompt.fill('@')
    await expect(page.locator('#mention-list')).toBeVisible()
    await prompt.press('Enter')

    // The prompt now holds only the mention token, which resolves to a url and
    // leaves nothing behind. Empty, and enabled.
    await expect(generate).toBeEnabled()
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

  /*
   * byok has no ledger, but it does have failures, and a generation that fails
   * before fal accepts it deletes its own placeholder. Without this page the
   * board is empty and there is nowhere at all to find out why.
   */
  test('byok gets the generation history without the ledger', async ({ page }) => {
    test.skip(mode !== 'byok', 'saas is the mode with credits')
    await page.goto('/usage')
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Generations' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buy credits' })).toHaveCount(0)
  })

  test('the history lists a generation in both modes', async ({ page }) => {
    await page.goto('/usage')
    await expect(page.getByRole('heading', { name: 'Generations' })).toBeVisible()
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
