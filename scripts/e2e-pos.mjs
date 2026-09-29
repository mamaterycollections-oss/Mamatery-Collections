// POS smoke test: attendant scans a barcode and takes an M-Pesa till payment.
// node scripts/e2e-pos.mjs <barcode> <outdir>
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('../../alicia-staffing-agency/node_modules/playwright') }
const [barcode, out = '.'] = process.argv.slice(2)
const pass = readFileSync('docs/LOCAL_CREDENTIALS.md', 'utf8').match(/attendant@mamaterry\.test \| `([^`]+)`/)[1]
const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
await page.goto('http://localhost:3000/login?next=/dashboard/pos', { waitUntil: 'networkidle' })
await page.fill('input[name=email]', 'attendant@mamaterry.test')
await page.fill('input[name=password]', pass)
await Promise.all([page.waitForURL('**/dashboard/pos', { timeout: 60000 }), page.click('button[type=submit]')])
await page.waitForLoadState('networkidle')
await page.fill('input[aria-label="Scan or search"]', barcode)
await page.keyboard.press('Enter')
await page.getByText('Charge').waitFor()
await page.waitForTimeout(800)
await page.getByRole('radio', { name: 'M-Pesa' }).click()
await page.fill('input[aria-label="M-Pesa confirmation code"]', 'SJK4TEST99')
await page.screenshot({ path: `${out}/pos-1.png` })
await page.getByRole('button', { name: /Charge/ }).click()
await page.getByText('Sale complete').waitFor({ timeout: 30000 })
await page.screenshot({ path: `${out}/pos-2.png` })
console.log('POS sale complete ✓')
await browser.close()
