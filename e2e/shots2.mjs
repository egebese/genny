import { chromium, devices } from '@playwright/test'

const base = 'http://localhost:3000'
const out = process.env.OUT
const b = await chromium.launch()

async function signedIn(opts = {}) {
  const c = await b.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
    ...opts,
  })
  const p = await c.newPage()
  await p.goto(base + '/signin')
  await p.getByLabel('Email').fill('demo@genny.local')
  await p.getByLabel('Password').fill('paper boat 2026')
  await p.getByRole('button', { name: 'Sign in' }).click()
  await p.waitForTimeout(2000)
  return p
}

const p = await signedIn()
await p.goto(base + '/image')
await p.waitForTimeout(3000)
await p.screenshot({ path: `${out}/a-feed.png` })

await p.getByRole('button', { name: /^Model:/ }).click()
await p.waitForTimeout(2500)
await p.screenshot({ path: `${out}/b-picker.png` })

// A stranger's context so the feed is empty and the openers show.
const fresh = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })
const q = await fresh.newPage()
await q.goto(base + '/video')
await q.waitForTimeout(2500)
await q.screenshot({ path: `${out}/c-empty.png` })

const phone = await b.newContext({ ...devices['iPhone 15'] })
const m = await phone.newPage()
await m.goto(base + '/signin')
await m.getByLabel('Email').fill('demo@genny.local')
await m.getByLabel('Password').fill('paper boat 2026')
await m.getByRole('button', { name: 'Sign in' }).click()
await m.waitForTimeout(2000)
await m.goto(base + '/image')
await m.waitForTimeout(3000)
await m.screenshot({ path: `${out}/d-mobile.png` })

console.log('shot')
await b.close()
