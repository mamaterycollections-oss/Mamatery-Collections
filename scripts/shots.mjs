// Dev helper: sign in once, screenshot several pages.
// node scripts/shots.mjs <role> <outdir> <path> [path...]   (role = owner|manager|attendant|customer)
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('../../alicia-staffing-agency/node_modules/playwright') }
const [role, out, ...paths] = process.argv.slice(2)
const email = `${role}@mamaterry.test`
const pass = readFileSync('docs/LOCAL_CREDENTIALS.md', 'utf8').split('\n').find((l) => l.includes(`${email} |`))?.split('`')[1]
const browser = await pw.chromium.launch()
const page = await (await browser.newContext(process.env.MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
await page.fill('input[name=email]', email)
await page.fill('input[name=password]', pass)
await page.click('button[type=submit]')
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 }) } catch { console.log('LOGIN FAILED:', await page.locator('[role=alert]').allInnerTexts(), 'pw len', pass.length); await browser.close(); process.exit(1) }
for (const p of paths) {
  const res = await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1200)
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
  await page.screenshot({ path: `${out}/${process.env.MOBILE ? 'm-' : ''}${role}-${name}.png`, fullPage: !process.env.MOBILE })
  console.log(res?.status(), p, '→', page.url().replace('http://localhost:3000', ''))
}
if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5))
await browser.close()
