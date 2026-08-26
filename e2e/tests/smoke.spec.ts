import { expect, test } from '@playwright/test'

test.describe('phase 0 shell', () => {
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

  test('studio lists the catalog and shows a prompt dock', async ({ page }) => {
    await page.goto('/image')
    await expect(page.getByRole('heading', { name: 'Image' })).toBeVisible()
    await expect(page.getByText('Nano Banana 2', { exact: true })).toBeVisible()
    await expect(page.getByText(/prompt composer/i)).toBeVisible()
  })

  test('security headers are present on every response', async ({ request }) => {
    const headers = (await request.get('/')).headers()
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('there is no sidebar and no dialog anywhere in the shell', async ({ page }) => {
    await page.goto('/image')
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    await expect(page.locator('aside')).toHaveCount(0)
  })

  test('the page does not scroll sideways on a phone', async ({ page }) => {
    await page.goto('/image')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
