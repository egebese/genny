import { expect, type Page, test } from '@playwright/test'

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
    await expect(panel.getByText('fal-ai/flux/schnell')).toBeVisible()
  })

  test('the node keeps its place while it fills @live', async ({ page }) => {
    await generate(page, 'schnell', 'a brass key on black velvet, overhead')
    const node = page.getByRole('listbox', { name: 'Canvas' }).getByRole('option').first()
    const reserved = await node.boundingBox()
    await expect(node.locator('img')).toBeVisible({ timeout: 300_000 })
    expect(await node.boundingBox()).toEqual(reserved)
  })
})

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
  if (options.count) await page.getByLabel('Images').fill(String(options.count))
  await page.getByRole('button', { name: /^Generate/ }).click()
}
