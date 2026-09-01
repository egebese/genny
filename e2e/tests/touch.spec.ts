import { expect, type Page, test } from '@playwright/test'

const mode = process.env.GENNY_MODE ?? 'byok'

async function openCanvas(page: Page): Promise<void> {
  await page.goto('/c')
  await page.getByRole('button', { name: 'New canvas' }).click()
  await page.waitForURL(/\/c\/[0-9a-f-]{36}/)
}

/**
 * Drives the board with synthetic pointer events.
 *
 * Playwright cannot do real multi-touch on WebKit, so these exercise our own
 * handlers rather than Safari's. That is worth saying out loud: it proves the
 * routing, the thresholds and the maths, and it does not prove iOS will hand us
 * the gesture in the first place. That part needs a real device.
 */
async function touch(
  page: Page,
  steps: { type: 'down' | 'move' | 'up'; id: number; x: number; y: number }[],
) {
  await page.evaluate((events) => {
    const surface = document.querySelector('.bg-canvas')
    if (!surface) throw new Error('no board surface')

    for (const step of events) {
      const name =
        step.type === 'down' ? 'pointerdown' : step.type === 'move' ? 'pointermove' : 'pointerup'
      const event = new PointerEvent(name, {
        pointerId: step.id,
        pointerType: 'touch',
        isPrimary: step.id === 1,
        clientX: step.x,
        clientY: step.y,
        bubbles: true,
        cancelable: true,
      })
      if (step.type === 'down') surface.dispatchEvent(event)
      else window.dispatchEvent(event)
    }
  }, steps)
}

function zoomOf(page: Page) {
  return page.evaluate(() => {
    const layer = document.querySelector('[role="listbox"]')
    const match = /scale\(([\d.]+)\)/.exec((layer as HTMLElement | null)?.style.transform ?? '')
    return Number(match?.[1] ?? 1)
  })
}

function translateOf(page: Page) {
  return page.evaluate(() => {
    const layer = document.querySelector('[role="listbox"]')
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      (layer as HTMLElement | null)?.style.transform ?? '',
    )
    return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) }
  })
}

test.describe('the board under a finger', () => {
  test.skip(mode !== 'saas', 'the dock needs credentials, and the gate covers the board')

  /*
   * Before this a phone could not move the board at all. Pan wanted the space
   * bar or a middle button, so one finger on empty space always drew a marquee.
   */
  test('one finger drags the board rather than drawing a marquee', async ({ page }) => {
    await openCanvas(page)
    const before = await translateOf(page)

    await touch(page, [
      { type: 'down', id: 1, x: 180, y: 200 },
      { type: 'move', id: 1, x: 185, y: 205 },
      { type: 'move', id: 1, x: 260, y: 300 },
      { type: 'move', id: 1, x: 280, y: 320 },
      { type: 'up', id: 1, x: 280, y: 320 },
    ])

    const after = await translateOf(page)
    expect(after.x).not.toBe(before.x)
    // A marquee would have drawn a rubber band; nothing in the DOM should have.
    expect(await page.locator('[data-marquee]').count()).toBe(0)
  })

  test('two fingers spreading zoom the board in', async ({ page }) => {
    await openCanvas(page)
    const before = await zoomOf(page)

    await touch(page, [
      { type: 'down', id: 1, x: 150, y: 250 },
      { type: 'down', id: 2, x: 200, y: 250 },
      { type: 'move', id: 1, x: 100, y: 250 },
      { type: 'move', id: 2, x: 250, y: 250 },
    ])

    expect(await zoomOf(page)).toBeGreaterThan(before)
    await touch(page, [
      { type: 'up', id: 1, x: 100, y: 250 },
      { type: 'up', id: 2, x: 250, y: 250 },
    ])
  })

  test('two fingers closing zoom it back out', async ({ page }) => {
    await openCanvas(page)
    await touch(page, [
      { type: 'down', id: 1, x: 100, y: 250 },
      { type: 'down', id: 2, x: 260, y: 250 },
      { type: 'move', id: 1, x: 170, y: 250 },
      { type: 'move', id: 2, x: 190, y: 250 },
    ])
    expect(await zoomOf(page)).toBeLessThan(1)
  })

  /*
   * iOS never fires `contextmenu`, so every menu action was unreachable on a
   * phone: attaching to a slot, variants, copy, paste, remove.
   */
  test('a long press on empty board opens the menu', async ({ page }) => {
    await openCanvas(page)
    await touch(page, [{ type: 'down', id: 1, x: 180, y: 220 }])
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('menuitem', { name: 'Paste' })).toBeVisible()
  })

  test('a press that moves is a pan, not a menu', async ({ page }) => {
    await openCanvas(page)
    await touch(page, [
      { type: 'down', id: 1, x: 180, y: 220 },
      { type: 'move', id: 1, x: 180, y: 260 },
    ])
    await page.waitForTimeout(700)
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  test('menu rows are big enough for a thumb', async ({ page }) => {
    await openCanvas(page)
    await touch(page, [{ type: 'down', id: 1, x: 180, y: 220 }])
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 3000 })

    for (const item of await page.getByRole('menuitem').all()) {
      const box = await item.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test('the menu fits inside the board it floats over', async ({ page }) => {
    await openCanvas(page)
    const width = page.viewportSize()?.width ?? 0
    await touch(page, [{ type: 'down', id: 1, x: Math.min(300, width - 40), y: 220 }])
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 3000 })

    const box = await page.getByRole('menu').boundingBox()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1)
  })
})

test.describe('the dock on a narrow screen', () => {
  test.skip(mode !== 'saas', 'the dock needs credentials to render')

  test('wraps so the settings are not squeezed to a sliver', async ({ page }) => {
    await openCanvas(page)
    const width = page.viewportSize()?.width ?? 0
    test.skip(width > 420, 'only the phone profiles wrap')

    const generate = await page.getByRole('button', { name: /^Generate/ }).boundingBox()
    const model = await page.getByRole('button', { name: /^Model:/ }).boundingBox()

    // Wrapped means the settings sit on their own line above the actions.
    expect(generate?.y ?? 0).toBeGreaterThan(model?.y ?? 0)
  })

  /*
   * The row scrolls with a finger, so the arrows are a hint rather than the
   * control. They were `opacity-0` until hover, which on a phone means invisible
   * forever, and the smoke test that would have caught it skips every viewport
   * under 700 because a phone row is always overflowing.
   */
  test('the overflow hint is visible on a touch screen', async ({ page }) => {
    await openCanvas(page)
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    test.skip(!coarse, 'this is about what a finger can see')

    await page.getByRole('button', { name: 'More settings' }).click()
    const arrow = page.getByRole('button', { name: 'Scroll settings right' })
    await expect(arrow).toBeVisible()
    expect(await arrow.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  })

  test('does not push the page sideways', async ({ page }) => {
    await openCanvas(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
