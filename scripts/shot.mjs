// Dev helper: screenshot pages.  node scripts/shot.mjs <path> <out.png> [mobile|desktop] [full] [email password]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('../../alicia-staffing-agency/node_modules/playwright') }
const [path, out, device = 'desktop', full, email, password] = process.argv.slice(2)
const browser = await pw.chromium.launch()
const ctx = await browser.newContext(device === 'mobile'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
if (email) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type=submit]')])
}
await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 90000 })
if (full === 'full') { for (let y = 0; y < 20000; y += 500) { await page.mouse.wheel(0, 500); await page.waitForTimeout(120) } await page.evaluate(() => window.scrollTo(0, 0)) }
await page.waitForTimeout(1800)
await page.screenshot({ path: out, fullPage: full === 'full' })
if (errors.length) console.log('PAGE ERRORS:\n' + errors.slice(0, 8).join('\n'))
await browser.close()
