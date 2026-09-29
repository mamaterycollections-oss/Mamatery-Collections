// Illustrated product images for the demo catalog (flat-lay style, 4:5).
// Real product photos uploaded in the dashboard replace these.

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
const isDark = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 110
}

// Each item on a 400×500 grid: body paths get the colour + shading, details are line work.
const ITEMS = {
  dress: {
    body: ['M148 92 L160 92 Q170 118 176 122 Q200 150 224 122 Q230 118 240 92 L252 92 Q258 150 262 205 Q300 330 336 440 Q200 474 64 440 Q100 330 138 205 Q142 150 148 92 Z'],
    lines: ['M138 205 Q200 218 262 205', 'M170 215 Q160 330 140 452', 'M230 215 Q240 330 262 452', 'M200 220 L200 462'],
    extra: (c) => `<path d="M148 92 L148 60 M252 92 L252 60" stroke="${shade(c, -0.35)}" stroke-width="4" stroke-linecap="round"/>`,
  },
  tee: {
    body: ['M140 90 Q200 118 260 90 L332 120 L362 192 L310 212 L296 182 L296 432 Q200 444 104 432 L104 182 L90 212 L38 192 L68 120 Z'],
    lines: ['M160 94 Q200 132 240 94', 'M104 182 L96 150', 'M296 182 L304 150', 'M110 420 Q200 430 290 420'],
  },
  hoodie: {
    back: ['M132 98 Q138 36 200 34 Q262 36 268 98 Q236 124 200 126 Q164 124 132 98 Z'],
    body: ['M135 95 Q200 126 265 95 L322 116 Q352 152 362 262 L372 402 L330 408 L318 272 L300 205 L300 432 Q200 444 100 432 L100 205 L82 272 L70 408 L28 402 L38 262 Q48 152 78 116 Z'],
    lines: ['M140 330 L260 330 L286 410 L114 410 Z', 'M188 128 L184 200', 'M212 128 L216 200', 'M104 418 Q200 430 296 418', 'M34 386 L72 390', 'M366 386 L328 390'],
  },
  trousers: {
    body: ['M128 70 L272 70 L278 112 L322 452 L214 458 L200 176 L186 458 L78 452 L122 112 Z'],
    lines: ['M128 96 L272 96', 'M200 96 L200 176', 'M156 120 L132 452', 'M244 120 L268 452', 'M150 96 Q160 128 186 132', 'M250 96 Q240 128 214 132'],
  },
  skirt: {
    body: ['M140 90 L260 90 L263 116 Q312 282 332 442 Q200 462 68 442 Q88 282 137 116 Z'],
    lines: ['M137 116 L263 116', 'M160 120 L118 448', 'M180 120 L160 454', 'M200 120 L200 456', 'M220 120 L240 454', 'M240 120 L282 448'],
  },
  blazer: {
    body: ['M120 80 L170 68 L200 150 L230 68 L280 80 L332 110 L348 402 L306 408 L300 192 L302 442 L98 442 L100 192 L94 408 L52 402 L68 110 Z'],
    lines: ['M200 150 L200 442', 'M120 330 L170 330', 'M230 330 L280 330', 'M58 380 L96 384', 'M342 380 L304 384'],
    extra: (c) => `<path d="M170 68 L200 150 L176 196 L148 108 Z M230 68 L200 150 L224 196 L252 108 Z" fill="${shade(c, -0.18)}" stroke="${shade(c, -0.4)}" stroke-width="2"/>
      <circle cx="200" cy="300" r="6" fill="${shade(c, -0.45)}"/><circle cx="200" cy="350" r="6" fill="${shade(c, -0.45)}"/>`,
  },
  handbag: {
    body: ['M92 222 L308 222 L334 418 Q336 436 318 436 L82 436 Q64 436 66 418 Z'],
    lines: ['M100 234 L300 234', 'M78 420 L322 420'],
    extra: (c) => `<path d="M148 222 Q148 118 200 118 Q252 118 252 222" fill="none" stroke="${shade(c, -0.35)}" stroke-width="12" stroke-linecap="round"/>
      <path d="M92 222 L308 222 L302 302 Q200 336 98 302 Z" fill="${shade(c, -0.12)}" stroke="${shade(c, -0.4)}" stroke-width="2"/>
      <rect x="186" y="300" width="28" height="22" rx="4" fill="#C49A4A"/><rect x="194" y="306" width="12" height="10" rx="2" fill="#8a6a2a"/>`,
  },
  tote: {
    body: ['M78 182 L322 182 L338 442 L62 442 Z'],
    lines: ['M80 214 L320 214', 'M120 300 L280 300 L284 400 L116 400 Z'],
    extra: (c) => `<path d="M132 182 Q132 58 200 58 Q268 58 268 182" fill="none" stroke="${shade(c, -0.35)}" stroke-width="11" stroke-linecap="round"/>
      <path d="M152 182 Q152 84 200 84 Q248 84 248 182" fill="none" stroke="${shade(c, -0.2)}" stroke-width="8" stroke-linecap="round"/>
      <text x="200" y="362" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="30" fill="${isDark(c) ? '#F4EDE2' : '#3a2a1f'}" opacity="0.8">MamaTerry</text>`,
  },
  crossbody: {
    body: ['M112 252 L288 252 Q306 252 306 270 L306 382 Q306 400 288 400 L112 400 Q94 400 94 382 L94 270 Q94 252 112 252 Z'],
    lines: ['M104 386 L296 386'],
    extra: (c) => `<path d="M100 262 Q40 120 200 56 Q360 120 300 262" fill="none" stroke="${shade(c, -0.35)}" stroke-width="6"/>
      <path d="M94 270 Q94 252 112 252 L288 252 Q306 252 306 270 L306 330 Q200 356 94 330 Z" fill="${shade(c, -0.14)}" stroke="${shade(c, -0.4)}" stroke-width="2"/>
      <circle cx="200" cy="336" r="11" fill="#C49A4A"/><circle cx="200" cy="336" r="5" fill="#8a6a2a"/>`,
  },
  clutch: {
    body: ['M70 196 L330 196 Q344 196 344 210 L344 352 Q344 366 330 366 L70 366 Q56 366 56 352 L56 210 Q56 196 70 196 Z'],
    lines: [],
    extra: (c) => `<path d="M58 202 L200 292 L342 202" fill="${shade(c, -0.16)}" stroke="${shade(c, -0.4)}" stroke-width="2" stroke-linejoin="round"/>
      <rect x="170" y="284" width="60" height="12" rx="6" fill="#C49A4A"/>`,
  },
  cap: {
    body: ['M92 302 Q88 150 200 138 Q312 150 308 302 Z'],
    lines: ['M200 140 L200 302', 'M200 140 Q130 180 124 302', 'M200 140 Q270 180 276 302'],
    extra: (c) => `<path d="M72 302 Q200 272 328 302 Q372 332 330 356 Q200 326 70 356 Q30 332 72 302 Z" fill="${shade(c, -0.1)}" stroke="${shade(c, -0.4)}" stroke-width="2"/>
      <path d="M86 320 Q200 296 314 320" fill="none" stroke="${shade(c, 0.25)}" stroke-width="2" stroke-dasharray="6 6"/>
      <circle cx="200" cy="140" r="9" fill="${shade(c, -0.3)}"/>
      <text x="200" y="258" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="${isDark(c) ? '#C49A4A' : '#8f3f1e'}">MT</text>`,
  },
  bucket: {
    body: ['M122 172 Q200 132 278 172 L296 302 L104 302 Z'],
    lines: ['M112 262 L288 262', 'M116 282 L284 282'],
    extra: (c) => `<path d="M104 300 Q200 276 296 300 L376 362 Q200 330 24 362 Z" fill="${shade(c, -0.08)}" stroke="${shade(c, -0.4)}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M60 346 Q200 318 340 346" fill="none" stroke="${shade(c, -0.3)}" stroke-width="2" stroke-dasharray="5 6"/>`,
  },
  sunglasses: {
    body: [
      'M52 222 Q52 190 90 190 L168 190 Q190 190 188 216 L182 266 Q178 298 142 298 L102 298 Q66 298 60 266 Z',
      'M348 222 Q348 190 310 190 L232 190 Q210 190 212 216 L218 266 Q222 298 258 298 L298 298 Q334 298 340 266 Z',
    ],
    lines: [],
    extra: (c) => `<path d="M188 212 Q200 198 212 212" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>
      <path d="M52 206 L20 190 M348 206 L380 190" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
      <path d="M66 226 Q70 204 94 204 L164 204 Q176 206 174 222 L168 262 Q164 284 140 284 L104 284 Q76 284 72 262 Z M334 226 Q330 204 306 204 L236 204 Q224 206 226 222 L232 262 Q236 284 260 284 L296 284 Q324 284 328 262 Z" fill="url(#lens)"/>`,
  },
  scarf: {
    body: ['M70 120 L330 120 L330 380 L70 380 Z'],
    lines: ['M90 140 L310 140 L310 360 L90 360 Z'],
    extra: () => `<g fill="none" stroke="#C49A4A" stroke-width="3" opacity="0.9">
      <circle cx="200" cy="250" r="58"/><circle cx="200" cy="250" r="34"/><circle cx="200" cy="250" r="12" fill="#C49A4A"/>
      <circle cx="120" cy="170" r="16"/><circle cx="280" cy="170" r="16"/><circle cx="120" cy="330" r="16"/><circle cx="280" cy="330" r="16"/>
      <path d="M142 250 L90 250 M258 250 L310 250 M200 192 L200 140 M200 308 L200 360"/></g>
      <path d="M330 380 L360 440 L300 420 Z" fill="url(#fold)"/>`,
  },
}

export function productSvg(type, colour, { alt = false, bg = '#EFE7DC' } = {}) {
  const item = ITEMS[type]
  const stroke = shade(colour, -0.4)
  const detail = isDark(colour) ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'
  const paths = (list) => list.map((d) => `<path d="${d}"/>`).join('')
  const scale = alt ? 2.1 : 1.78
  const tx = 450 - 200 * scale
  const ty = (alt ? 580 : 530) - 250 * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125" viewBox="0 0 900 1125">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(bg, 0.25)}"/><stop offset="1" stop-color="${shade(bg, -0.05)}"/></linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b3b44"/><stop offset="1" stop-color="#0d0d12"/></linearGradient>
    <linearGradient id="fold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(colour, -0.3)}"/><stop offset="1" stop-color="${shade(colour, -0.1)}"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="900" height="1125" fill="url(#bg)"/>
  ${alt ? `<circle cx="760" cy="150" r="220" fill="${shade(bg, -0.08)}" opacity="0.6"/>` : `<rect x="0" y="900" width="900" height="225" fill="${shade(bg, -0.06)}" opacity="0.5"/>`}
  <ellipse cx="450" cy="${alt ? 1080 : 915}" rx="${alt ? 330 : 270}" ry="30" fill="#000" opacity="0.13" filter="url(#soft)"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})" stroke-linejoin="round">
    ${item.back ? `<g fill="${shade(colour, -0.18)}" stroke="${stroke}" stroke-width="2">${paths(item.back)}</g>` : ''}
    <g fill="${colour}" stroke="${stroke}" stroke-width="2">${paths(item.body)}</g>
    ${item.extra ? item.extra(colour) : ''}
    <g fill="url(#shine)">${paths(item.body)}</g>
    <g fill="none" stroke="${detail}" stroke-width="2.2" stroke-linecap="round">${paths(item.lines)}</g>
  </g>
</svg>`
}
