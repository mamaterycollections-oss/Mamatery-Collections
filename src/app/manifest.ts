import type { MetadataRoute } from 'next'

// Web app manifest: makes the site installable (PWA) and is the source for the
// Android app (Trusted Web Activity) published to Google Play.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MamaTerryCollections',
    short_name: 'MamaTerry',
    description: 'Clothes, bags, caps and accessories — pay with M-Pesa, delivered across Kenya.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#FBF8F3',
    theme_color: '#FBF8F3',
    lang: 'en-KE',
    dir: 'ltr',
    categories: ['shopping', 'lifestyle'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: '/screenshots/home.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Shop the latest arrivals' },
      { src: '/screenshots/product.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Pick your size and colour' },
      { src: '/screenshots/checkout.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Pay with M-Pesa' },
    ],
    shortcuts: [
      { name: 'New arrivals', url: '/shop?sort=new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'My orders', url: '/account/orders', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Quick sale (staff)', url: '/dashboard/pos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
