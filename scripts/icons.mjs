// Generates app icons, PWA/Android icons, Play Store graphics and the social
// share image from the brand mark.   npm run icons
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const INK = '#17130F'
const PAPER = '#FBF8F3'
const CLAY = '#B4532A'
const GOLD = '#C49A4A'

// Brand mark on a 100×100 grid: a hanger hook over a serif "M".
const mark = (fg = PAPER, accent = GOLD) => `
  <path d="M50 17.5c0-4.2 3.2-7.3 7.2-7.3 3.9 0 6.9 2.9 6.9 6.6 0 3.2-2.1 5.3-5.1 6.6-2.4 1-4 2.4-4 5v2.6" fill="none" stroke="${accent}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M50 31 18 47.5h64Z" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linejoin="round"/>
  <text x="50" y="86" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" fill="${fg}">M</text>`

const square = (size, { bg = CLAY, scale = 0.78, fg = PAPER, accent = GOLD, radius = 0 } = {}) => {
  const s = (size * scale) / 100
  const offset = (size - 100 * s) / 2
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : ''}
    <g transform="translate(${offset} ${offset}) scale(${s})">${mark(fg, accent)}</g>
  </svg>`)
}

for (const dir of ['public/icons', 'store', 'src/app']) mkdirSync(dir, { recursive: true })

const jobs = [
  // PWA "any" icons
  [square(192, { scale: 0.8 }), 'public/icons/icon-192.png'],
  [square(512, { scale: 0.8 }), 'public/icons/icon-512.png'],
  // Maskable (Android adaptive): mark kept inside the ~80% safe circle
  [square(192, { scale: 0.58 }), 'public/icons/maskable-192.png'],
  [square(512, { scale: 0.58 }), 'public/icons/maskable-512.png'],
  // Monochrome badge for Android notifications (white on transparent)
  [square(96, { bg: null, scale: 0.95, fg: '#FFFFFF', accent: '#FFFFFF' }), 'public/icons/badge-96.png'],
  // Favicon + Apple touch icon (Next.js picks these up from src/app)
  [square(64, { scale: 0.86, radius: 14 }), 'src/app/icon.png'],
  [square(180, { scale: 0.78 }), 'src/app/apple-icon.png'],
  // Google Play high-res icon (512×512, full-bleed; Play applies the mask)
  [square(512, { scale: 0.74 }), 'store/play-icon-512.png'],
]
for (const [svg, file] of jobs) {
  await sharp(svg).png().toFile(file)
  console.log('wrote', file)
}

// Inline SVG mark for the website header / emails
writeFileSync('public/icons/mark.svg', square(100, { scale: 0.86, radius: 22 }).toString())

const banner = (w, h, title, sub) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INK}"/><stop offset="1" stop-color="#3a2a1f"/></linearGradient>
    <radialGradient id="r" cx="0.85" cy="0.2" r="0.6"><stop offset="0" stop-color="${CLAY}" stop-opacity="0.55"/><stop offset="1" stop-color="${CLAY}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#r)"/>
  <circle cx="${w - 120}" cy="${h + 40}" r="${h * 0.55}" fill="none" stroke="${GOLD}" stroke-opacity="0.25" stroke-width="2"/>
  <circle cx="${w - 120}" cy="${h + 40}" r="${h * 0.42}" fill="none" stroke="${GOLD}" stroke-opacity="0.18" stroke-width="2"/>
  <g transform="translate(${h * 0.16} ${h * 0.25}) scale(${(h * 0.5) / 100})">
    <rect width="100" height="100" rx="22" fill="${CLAY}"/>
    <g transform="translate(7 7) scale(0.86)">${mark()}</g>
  </g>
  <text x="${h * 0.8}" y="${h * 0.46}" font-family="Georgia, serif" font-size="${h * 0.15}" font-weight="700" fill="${PAPER}">${title}</text>
  <text x="${h * 0.8 + 4}" y="${h * 0.58}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${h * 0.045}" letter-spacing="${h * 0.012}" fill="${GOLD}">COLLECTIONS</text>
  <text x="${h * 0.8 + 2}" y="${h * 0.72}" font-family="Arial, Helvetica, sans-serif" font-size="${h * 0.052}" fill="${PAPER}" fill-opacity="0.85">${sub}</text>
</svg>`)

await sharp(banner(1024, 500, 'MamaTerry', 'Clothes · Bags · Caps — pay with M-Pesa')).png().toFile('store/feature-graphic-1024x500.png')
console.log('wrote store/feature-graphic-1024x500.png')
await sharp(banner(1200, 630, 'MamaTerry', 'Clothes, bags &amp; caps · Delivered across Kenya')).png().toFile('src/app/opengraph-image.png')
console.log('wrote src/app/opengraph-image.png')
