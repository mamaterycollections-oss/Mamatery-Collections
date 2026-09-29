/* MamaTerryCollections service worker — offline shell, asset caching, push. */
const VERSION = 'mt-v1'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`
const IMAGES = `${VERSION}-images`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/badge-96.png'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const trim = async (name, max) => {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Never cache private or live data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/account') ||
      url.pathname.startsWith('/checkout') || url.pathname.startsWith('/orders') || url.hostname.endsWith('supabase.co') && !url.pathname.includes('/storage/v1/object/public/')) {
    if (req.mode === 'navigate') {
      event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    }
    return
  }

  // Pages: network first, fall back to the last copy, then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, 30))
          }
          return res
        })
        .catch(async () => (await caches.match(req)) || caches.match(OFFLINE_URL)),
    )
    return
  }

  // Build assets and icons never change for a given URL: cache first.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(STATIC).then((c) => c.put(req, copy))
        return res
      })),
    )
    return
  }

  // Product images (optimised or from storage): stale-while-revalidate.
  if (url.pathname.startsWith('/_next/image') || url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).then(() => trim(IMAGES, 150))
            return res
          })
          .catch(() => hit)
        return hit || network
      }),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'MamaTerryCollections', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'MamaTerryCollections', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/' },
      tag: data.tag,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.startsWith(self.location.origin))
      if (existing) {
        existing.navigate(target)
        return existing.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
