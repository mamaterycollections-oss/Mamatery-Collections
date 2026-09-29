// Captures 1080×1920 phone screenshots for the web manifest and Google Play.
//   node scripts/store-screenshots.mjs [baseUrl]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('../../alicia-staffing-agency/node_modules/playwright') }
const BASE = process.argv[2] ?? 'http://localhost:3000'
mkdirSync('public/screenshots', { recursive: true })

const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage()
const settle = async () => {
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }) // hide the dev-mode badge
  await page.waitForTimeout(2200)
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await settle()
await page.screenshot({ path: 'public/screenshots/home.png' })

await page.goto(`${BASE}/product/amani-wrap-midi-dress`, { waitUntil: 'networkidle' })
await settle()
const size = page.locator('#size-picker button[aria-pressed]:not(.line-through)').first()
await size.evaluate((e) => e.scrollIntoView({ block: 'center' }))
await size.evaluate((e) => e.click())
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
await page.screenshot({ path: 'public/screenshots/product.png' })

await page.locator('button:has-text("Add to bag")').last().click()
await page.getByRole('link', { name: 'Checkout securely' }).click()
await page.waitForURL('**/checkout')
await settle()
await page.fill('#co-name', 'Achieng Otieno')
await page.fill('#co-phone', '0712 345 678')
await page.getByRole('radio', { name: /Nairobi/ }).first().click()
await page.fill('#co-address', 'Kilimani, Argwings Kodhek Rd')
await page.locator('h2:has-text("Delivery")').evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90) })
await page.waitForTimeout(600)
await page.screenshot({ path: 'public/screenshots/checkout.png' })
console.log('saved public/screenshots/{home,product,checkout}.png')
await browser.close()
