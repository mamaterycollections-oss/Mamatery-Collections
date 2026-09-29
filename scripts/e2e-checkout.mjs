// End-to-end smoke test of the purchase flow against the running dev server
// (MPESA_ENV=simulate). node scripts/e2e-checkout.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('../../alicia-staffing-agency/node_modules/playwright') }
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.argv[2] ?? '.'

const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const step = (m) => console.log('→', m)

step('open product')
await page.goto(`${BASE}/product/essential-oversized-tee`, { waitUntil: 'networkidle' })
// pick an in-stock size
const sizes = page.locator('#size-picker button[aria-pressed]:not(.line-through)')
await sizes.first().click()
step('add to bag')
await page.locator('button:has-text("Add to bag")').last().click()
await page.getByRole('dialog', { name: 'Shopping bag' }).waitFor()
await page.screenshot({ path: `${out}/e2e-1-bag.png` })
await page.getByRole('link', { name: 'Checkout securely' }).click()
await page.waitForURL('**/checkout')
step('fill checkout')
await page.fill('#co-name', 'E2E Test Buyer')
await page.fill('#co-phone', '0712345678')
await page.fill('#co-email', 'e2e@mamaterry.test')
await page.getByRole('radio', { name: /Nairobi/ }).first().click()
await page.fill('#co-address', 'Test Street, Kilimani')
await page.screenshot({ path: `${out}/e2e-2-checkout.png`, fullPage: true })
await page.locator('button[type=submit]:visible').last().click()
step('wait for order page')
await page.waitForURL('**/orders/**', { timeout: 60000 })
await page.screenshot({ path: `${out}/e2e-3-waiting.png` })
await page.getByText('Payment received!').waitFor({ timeout: 60000 })
step('paid ✓')
await page.waitForURL(/new=1/, { timeout: 30000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}/e2e-4-confirmed.png`, fullPage: true })
console.log('ORDER URL', page.url())
if (errors.length) console.log('PAGE ERRORS', errors)
await browser.close()
