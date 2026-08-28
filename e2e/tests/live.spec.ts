import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * The only tests that spend real money, and the only ones that prove a catalog
 * entry is right. A wrong field name answers 422 from fal and the reason is
 * invisible from our side, so a mocked suite stays green while every generation
 * on that model fails.
 *
 *   E2E_LIVE=1 FAL_KEY=... GENNY_MODE=byok pnpm e2e -- live.spec.ts
 *
 * Excluded by default in playwright.config.ts, by the @live tag.
 */
const key = process.env.FAL_KEY

test.describe('@live against real fal', () => {
  test.skip(!key, 'needs a real FAL_KEY')
  test.skip(process.env.GENNY_MODE === 'saas', 'byok, so the key is explicitly the one given')
  // Real models, real queues. Kling alone is a couple of minutes.
  test.setTimeout(10 * 60 * 1000)

  test('an image lands on the board as a node of ours @live', async ({ page }) => {
    // A tenth of a cent.
    await generate(page, 'schnell', 'a single red leaf on wet slate, overhead')
    await expect(page.locator('main img[src*="/genny/"]').first()).toBeVisible({ timeout: 300_000 })
  })

  test('speech arrives as audio, from the model that calls the prompt text @live', async ({
    page,
  }) => {
    // A third of a cent, and the only model whose prompt field is not `prompt`.
    await generate(page, 'ElevenLabs', 'Genny now speaks, not only draws.')
    await expect(page.locator('main audio').first()).toBeVisible({ timeout: 300_000 })
  })

  test('a video arrives and plays @live', async ({ page }) => {
    // Thirty-five cents. The expensive one, and the reason this file is opt-in.
    await generate(page, 'Kling', 'a paper boat drifting down a rain gutter, close up')
    await expect(page.locator('main video').first()).toBeVisible({ timeout: 540_000 })
  })

  /*
   * Both H3 Max endpoints, because the family picks between them and nothing
   * mocked can tell you it picked right. A tenth of a cent each.
   */
  test('H3 Max writes a clip from the prompt alone @live', async ({ page }) => {
    await generate(page, 'MiniMax H3 Max', 'a paper boat drifting down a rain gutter, close up')
    await expect(page.locator('main video').first()).toBeVisible({ timeout: 300_000 })
    await expectRanOn(page, 'MiniMax H3 Max Text to Video')
  })

  test('an image attached to H3 Max sends it to the other endpoint @live', async ({ page }) => {
    await generate(page, 'schnell', 'a single red leaf on wet slate, overhead')
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.first().locator('img')).toBeVisible({ timeout: 300_000 })

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page.getByPlaceholder('Search models').fill('MiniMax H3 Max')
    await page.locator('[cmdk-group-items] [role=option]').first().click()

    await nodes.first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: /start frame/i }).click()
    await page.getByLabel('Prompt', { exact: true }).fill('the leaf lifts and turns in the wind')
    await page.getByRole('button', { name: /^Generate/ }).click()

    await expect(page.locator('main video').first()).toBeVisible({ timeout: 300_000 })
    // The picker only ever offered the model. Which of its two endpoints ran is
    // decided by what was attached, and this is the only place that shows.
    await expectRanOn(page, 'MiniMax H3 Max Image to Video')
  })

  test('four variants of a still, each different in one way @live', async ({ page }) => {
    /*
     * The only place the agent path can be proved. Nothing mocked reaches a
     * language model, so a broken system prompt, a schema that does not match
     * what the model answers, or an endpoint that cannot take the image back
     * all look exactly like a passing suite.
     */
    await generate(page, 'Nano Banana 2', 'a single red leaf on wet slate, overhead')
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.first().locator('img')).toBeVisible({ timeout: 300_000 })

    await nodes.first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Make four variants' }).click()

    // One agent call, then four generations. Five rectangles on the board.
    await expect(nodes).toHaveCount(5, { timeout: 120_000 })
    for (let at = 1; at <= 4; at++) {
      await expect(nodes.nth(at).locator('img')).toBeVisible({ timeout: 300_000 })
    }

    // Each one ran on the edit endpoint, which is the part the family resolves:
    // the picker only ever offered Nano Banana 2.
    await expectRanOn(page, 'Nano Banana 2 Edit')
  })

  test('a model that cannot take an image says so before spending @live', async ({ page }) => {
    await generate(page, 'ElevenLabs', 'Genny now speaks, not only draws.')
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.first().locator('audio')).toBeVisible({ timeout: 300_000 })

    // Not an image, so the item is not offered at all and no agent is asked.
    await nodes.first().click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Make four variants' })).toHaveCount(0)
  })

  test('an upload is catalogued, and then findable by what it is @live', async ({ page }) => {
    /*
     * The whole point of the library rework, and unprovable anywhere else: a
     * mocked suite never reaches a model, so a wrong system prompt, a schema
     * that does not match what comes back, or an analysis that silently never
     * runs all look like a passing test.
     */
    await withKey(page)
    await page.goto('/assets')
    await page.locator('input[type=file]').setInputFiles('fixtures/leaf.jpg')
    await expect(page.locator('ul.grid li').first()).toBeVisible()

    /*
     * Filed after the response, so the first render shows the handle and the
     * description lands on a later one. The handle never goes away, it moves to
     * the second line, so what proves this is the title line ceasing to be it.
     */
    const title = page.locator('ul.grid li').first().locator('span.text-sm').first()
    await expect(title).toHaveText('@leaf')
    await expect(async () => {
      await page.reload()
      await expect(title).not.toHaveText(/^@/)
    }).toPass({ timeout: 120_000 })

    // And the search that only works because something described it.
    await page.getByLabel('Search assets').fill('leaf')
    await expect(page.locator('ul.grid li')).toHaveCount(1)

    await page.getByLabel('Search assets').fill('hoodie')
    await expect(page.getByText('Nothing matches that.')).toBeVisible()
  })

  test('ten results in, the board says what it has turned out to be @live', async ({ page }) => {
    /*
     * Ten schnell images, a tenth of a cent each, then one text agent call. The
     * only place this can be proved: whether the reading is any good is a
     * question about a real model reading real prompts, and a mocked suite
     * would assert that a row exists and learn nothing.
     */
    test.setTimeout(15 * 60 * 1000)
    await withKey(page)
    await page.goto('/c')
    await page.getByRole('button', { name: 'New canvas' }).click()
    await page.waitForURL(/\/c\/[0-9a-f-]{36}/)

    await page.getByRole('button', { name: /^Model:/ }).click()
    await page
      .getByRole('option', { name: /schnell/ })
      .first()
      .click()

    // One coherent brief, said ten different ways, which is what a real board
    // looks like and what the reading has to find the shape of.
    const shots = [
      'an off-white oversize hoodie on a concrete plinth, overcast light',
      'the same hoodie folded on raw concrete, overcast light',
      'a charcoal hoodie on a concrete plinth, overcast light, no warm tones',
      'an off-white hoodie hanging against a bare wall, flat grey light',
      'a close crop of off-white knit texture, overcast',
      'an off-white hoodie on a plinth, three quarter angle, flat light',
      'a stack of folded off-white knitwear, concrete floor, no warm tones',
      'an off-white hoodie, back view, overcast light',
      'off-white knit sleeve detail on concrete, flat grey light',
      'an off-white hoodie on a plinth, wide shot, overcast, no warm tones',
    ]
    for (const shot of shots) {
      await page.getByLabel('Prompt', { exact: true }).fill(shot)
      await page.getByRole('button', { name: /^Generate/ }).click()
      await page.waitForTimeout(1200)
    }

    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes).toHaveCount(shots.length)
    await expect(nodes.last().locator('img')).toBeVisible({ timeout: 300_000 })

    // Read after the tenth, in the background, so the page has to be revisited.
    await page.goto('/c')
    await page.locator('main section').first().getByRole('link').first().click()
    await page.waitForURL(/\/p\//)

    const said = page.getByRole('heading', { name: 'What the work says' })
    await expect(async () => {
      await page.reload()
      await expect(said).toBeVisible()
    }).toPass({ timeout: 180_000 })

    // It found the subject. Not asserting on the whole sentence: it is a model's
    // words, and pinning those would be a test of its phrasing.
    await expect(page.getByText(/hoodie|knitwear|knit/i).first()).toBeVisible()
  })

  test('the director answers, and its shots load into the prompt @live', async ({ page }) => {
    await generate(page, 'schnell', 'an off-white oversize hoodie on a concrete plinth, overcast')
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.first().locator('img')).toBeVisible({ timeout: 300_000 })

    await page.getByRole('button', { name: 'Direct' }).click()
    await page.getByLabel('Prompt', { exact: true }).fill('three more shots to round out this set')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()

    // It replies, and because shots were asked for, it proposes some.
    const shot = page.locator('[data-dock] article button').first()
    await expect(shot).toBeVisible({ timeout: 120_000 })

    /*
     * A proposal loads into the prompt and is not run. The agent wrote a
     * sentence; whether to spend money on it is not its decision, and the
     * price belongs on the button as it always is.
     */
    const before = await nodes.count()
    await shot.click()
    await expect(page.getByLabel('Prompt', { exact: true })).not.toHaveValue('')
    await expect(page.getByRole('button', { name: /^Generate/ })).toBeVisible()
    await expect(nodes).toHaveCount(before)
  })

  test('the director answers a question without proposing anything @live', async ({ page }) => {
    await generate(page, 'schnell', 'an off-white oversize hoodie on a concrete plinth, overcast')
    await expect(
      page.getByRole('listbox', { name: 'Canvas' }).getByRole('option').first().locator('img'),
    ).toBeVisible({ timeout: 300_000 })

    await page.getByRole('button', { name: 'Direct' }).click()
    await page.getByLabel('Prompt', { exact: true }).fill('what is wrong with this shot?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()

    // A reply arrives. Padding a critique with prompts nobody asked for spends
    // their money, so the shots are expected to be absent.
    await expect(page.locator('[data-dock] article p').nth(1)).toBeVisible({ timeout: 120_000 })
    await expect(page.locator('[data-dock] article button')).toHaveCount(0)
  })

  /*
   * The three below are the only place these can be proved. The mocked suite
   * never completes a job, so a placeholder never fills, an info button never
   * appears and there is nothing to inspect.
   */
  test('a request for several reserves a box for each of them @live', async ({ page }) => {
    await generate(page, 'schnell', 'a folded paper crane on grey concrete, top down', {
      count: 2,
    })
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    // Before the first result exists. Reserving one box and letting the second
    // appear later drops it wherever the layout has room by then.
    await expect(nodes).toHaveCount(2)
    await expect(nodes.first().getByText('Generating')).toBeVisible()
    await expect(nodes.nth(1).getByText('Generating')).toBeVisible()

    await expect(nodes.first().locator('img')).toBeVisible({ timeout: 300_000 })
    await expect(nodes.nth(1).locator('img')).toBeVisible({ timeout: 300_000 })
    await expect(nodes).toHaveCount(2)
  })

  test('the prompt survives sending it @live', async ({ page }) => {
    const prompt = 'a brass compass on a folded map, overhead'
    await generate(page, 'schnell', prompt)
    // Most of the next prompt is this one with a word changed.
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue(prompt)
  })

  test('details open from the icon on the result, not from selecting it @live', async ({
    page,
  }) => {
    await generate(page, 'schnell', 'a single brass key on black velvet, overhead')
    const node = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option').first()
    await expect(node.locator('img')).toBeVisible({ timeout: 300_000 })

    const panel = page.getByRole('complementary', { name: 'Generation details' })
    await node.click()
    // Selecting is for dragging and deleting. Opening a panel over the thing
    // being dragged is what made the two the same click a mistake.
    await expect(panel).toHaveCount(0)

    await node.getByRole('button', { name: 'Generation details' }).click()
    await expect(panel).toBeVisible()
    await expect(panel.getByText('FLUX.1 [schnell]', { exact: true })).toBeVisible()
  })

  test('a dragged node lines up with its neighbours @live', async ({ page }) => {
    await generate(page, 'schnell', 'a smooth river stone, macro', { count: 2 })
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.nth(1).locator('img')).toBeVisible({ timeout: 300_000 })

    const anchor = await nodes.nth(0).boundingBox()
    const moving = await nodes.nth(1).boundingBox()
    if (!anchor || !moving) throw new Error('no nodes to drag')

    // Down and a few pixels shy of the first node's left edge: near enough to
    // line up, far enough that landing there by hand would be luck.
    await page.mouse.move(moving.x + 40, moving.y + 40)
    await page.mouse.down()
    await page.mouse.move(anchor.x + 44, moving.y + 260, { steps: 12 })
    await expect(page.locator('[aria-hidden].bg-accent')).toHaveCount(1)
    await page.mouse.up()

    const landed = await nodes.nth(1).boundingBox()
    expect(Math.round(landed?.x ?? -1)).toBe(Math.round(anchor.x))
    // The guide is for the drag, not for the board.
    await expect(page.locator('[aria-hidden].bg-accent')).toHaveCount(0)
  })

  test('dragging one of a selection moves all of it @live', async ({ page }) => {
    await generate(page, 'schnell', 'a smooth river stone, macro', { count: 3 })
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.nth(2).locator('img')).toBeVisible({ timeout: 300_000 })
    await page.getByRole('button', { name: 'Fit' }).click()

    const before = await boxes(nodes, 3)

    await page.waitForTimeout(900)
    // A band across all three, then a drag from the middle one.
    await page.mouse.move(40, 130)
    await page.mouse.down()
    await page.mouse.move(1390, 700, { steps: 12 })
    await page.mouse.up()
    await expect(
      page.getByRole('listbox', { name: 'Canvas' }).locator('[aria-selected="true"]'),
    ).toHaveCount(3)

    const grabbed = before[1]
    if (!grabbed) throw new Error('nothing to drag')
    await page.mouse.move(grabbed.x + 40, grabbed.y + 40)
    await page.mouse.down()
    await page.mouse.move(grabbed.x + 40, grabbed.y + 220, { steps: 12 })
    await page.mouse.up()

    // The same delta for all of them: a selection is a shape, and moving its
    // members by different amounts would pull it apart on the way.
    for (const [at, start] of before.entries()) {
      const now = await nodes.nth(at).boundingBox()
      expect(Math.round((now?.x ?? 0) - (start?.x ?? 0))).toBe(0)
      expect(Math.round((now?.y ?? 0) - (start?.y ?? 0))).toBe(180)
    }

    /*
     * And all of them are written, not only the one under the pointer.
     *
     * Compared against where they were after the drag rather than before it:
     * the viewport is saved too, and a reload restores it, so screen
     * coordinates are only comparable within one view.
     */
    const dropped = await boxes(nodes, 3)
    await page.reload()
    await expect(nodes.nth(2).locator('img')).toBeVisible({ timeout: 30_000 })
    expect(await boxes(nodes, 3)).toEqual(dropped)
  })

  test('attachments follow the model and are placed again @live', async ({ page }) => {
    await generate(page, 'schnell', 'a smooth river stone, macro', { count: 2 })
    const nodes = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option')
    await expect(nodes.nth(1).locator('img')).toBeVisible({ timeout: 300_000 })

    const pick = async (query: string) => {
      await page.getByRole('button', { name: /^Model:/ }).click()
      await page.getByPlaceholder('Search models').fill(query)
      await page.locator('[cmdk-group-items] [role=option]').first().click()
    }
    const strip = page.getByRole('list', { name: 'Attached to this generation' })
    const slots = async () =>
      (await strip.getByRole('listitem').allInnerTexts()).map((text) => text.split('\n')[0])

    await pick('PixVerse')
    /*
     * The menu offers the slots of the endpoint this model would run once these
     * are added, so the first image sees one frame and the second sees two: with
     * one already attached, two images reach the transition.
     */
    await nodes.nth(0).click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: /Use as/ })).toHaveCount(1)
    await page.getByRole('menuitem', { name: /start frame/i }).click()

    await nodes.nth(1).click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: /Use as/ })).toHaveCount(2)
    await page.getByRole('menuitem', { name: /end frame/i }).click()
    expect(await slots()).toEqual(['Start frame', 'End frame'])

    /*
     * Changing the model used to drop all of this. What someone attached is what
     * they want to work with; the field is our bookkeeping, and it is redone in
     * the order things were added.
     */
    await pick('Nano Banana 2')
    expect(await slots()).toEqual(['Add to input images', 'Add to input images'])

    await pick('Kling 2.5')
    expect(await slots()).toEqual(['Start frame', 'End frame'])

    // And dropped where there is nowhere to put them, rather than carried to a 422.
    await pick('ElevenLabs')
    await expect(strip).toHaveCount(0)
  })

  test('shift holds a drag to one axis @live', async ({ page }) => {
    await generate(page, 'schnell', 'a brass key on black velvet, overhead')
    const node = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option').first()
    await expect(node.locator('img')).toBeVisible({ timeout: 300_000 })

    const before = await node.boundingBox()
    if (!before) throw new Error('no node to drag')

    await page.keyboard.down('Shift')
    await page.mouse.move(before.x + 40, before.y + 40)
    await page.mouse.down()
    // Mostly sideways, and enough vertical that an unlocked drag would show it.
    await page.mouse.move(before.x + 240, before.y + 130, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Shift')

    const after = await node.boundingBox()
    expect(Math.abs((after?.y ?? 0) - before.y)).toBeLessThan(2)
    expect((after?.x ?? 0) - before.x).toBeGreaterThan(150)
  })

  test('the node keeps its place while it fills @live', async ({ page }) => {
    await generate(page, 'schnell', 'a brass key on black velvet, overhead')
    const node = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option').first()
    const reserved = await node.boundingBox()
    await expect(node.locator('img')).toBeVisible({ timeout: 300_000 })
    expect(await node.boundingBox()).toEqual(reserved)
  })
})

/** The endpoint the newest node actually ran on, read off its details panel. */
/**
 * Proves which endpoint of a family actually ran, by its name.
 *
 * Not by its id: the panel deliberately stopped printing `fal-ai/flux/schnell`
 * under the model name, and the id now lives inside the clipboard payload of
 * the support button, where nothing can read it. The display names differ per
 * endpoint anyway, so this asserts the thing a person would check.
 */
async function expectRanOn(page: Page, modelName: string): Promise<void> {
  const node = page
    .getByRole('listbox', { name: 'Canvas' })
    .getByRole('option')
    .filter({ has: page.locator('video, audio, img') })
    .last()
  await node.getByRole('button', { name: 'Generation details' }).click()
  const panel = page.getByRole('complementary', { name: 'Generation details' })
  await expect(panel).toBeVisible()
  // The panel names the model twice, as its heading and again in the Model
  // block. Either one proves the point; asking for both is strict-mode noise.
  await expect(panel.getByText(modelName, { exact: true }).first()).toBeVisible()
}

/** The key, through the route: Next's dev logger prints server action arguments. */
async function withKey(page: Page): Promise<void> {
  await page.goto('/c')
  await page.evaluate(async (value) => {
    await fetch('/api/session/fal-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: value }),
    })
  }, key)
}

async function generate(
  page: Page,
  model: string,
  prompt: string,
  options: { count?: number } = {},
): Promise<void> {
  await page.goto('/c')

  // Through the route rather than the form: Next's dev logger prints server
  // action arguments, and a fal key is not something to write to a terminal.
  await page.evaluate(async (value) => {
    await fetch('/api/session/fal-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: value }),
    })
  }, key)

  await page.goto('/c')
  await page.getByRole('button', { name: 'New canvas' }).click()
  await page.waitForURL(/\/c\/[0-9a-f-]{36}/)

  await page.getByRole('button', { name: /^Model:/ }).click()
  await page
    .getByRole('option', { name: new RegExp(model) })
    .first()
    .click()

  // Exact: a model control called "Prompt strength" would otherwise match too.
  await page.getByLabel('Prompt', { exact: true }).fill(prompt)
  // A stepper, not a field: the endpoint's own max is the ceiling and a typed
  // number could walk past it.
  for (let made = 1; made < (options.count ?? 1); made++) {
    await page.getByRole('button', { name: 'One more images' }).click()
  }
  await page.getByRole('button', { name: /^Generate/ }).click()
}

/** Rounded, because a sub-pixel difference across a reload is not a move. */
async function boxes(nodes: Locator, count: number) {
  const found = []
  for (let at = 0; at < count; at++) {
    const box = await nodes.nth(at).boundingBox()
    found.push({ x: Math.round(box?.x ?? 0), y: Math.round(box?.y ?? 0) })
  }
  return found
}
