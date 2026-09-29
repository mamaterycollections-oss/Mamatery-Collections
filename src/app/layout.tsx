import type { Metadata, Viewport } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { siteUrl } from '@/lib/site-url'
import { Providers } from '@/components/providers'
import './globals.css'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap', axes: ['opsz', 'SOFT'] })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'MamaTerryCollections — Clothes, Bags & Caps in Kenya',
    template: '%s · MamaTerryCollections',
  },
  description:
    'Shop dresses, tops, handbags, caps and accessories from MamaTerryCollections. Pay with M-Pesa and get delivery across Kenya.',
  applicationName: 'MamaTerry',
  appleWebApp: { capable: true, title: 'MamaTerry', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'MamaTerryCollections',
    locale: 'en_KE',
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: '#FBF8F3',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-KE" className={`${fraunces.variable} ${manrope.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
