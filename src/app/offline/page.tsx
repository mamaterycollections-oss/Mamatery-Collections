import type { Metadata } from 'next'
import { Logo } from '@/components/brand/logo'
import { RetryButton } from './retry'

export const metadata: Metadata = { title: 'You’re offline' }
export const dynamic = 'force-static'

// Cached by the service worker and shown when there's no connection.
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
      <div>
        <Logo />
        <h1 className="mt-10 font-display text-4xl">You’re offline</h1>
        <p className="mx-auto mt-3 max-w-xs text-muted">Check your data or Wi-Fi connection. Your bag is saved on this device.</p>
        <RetryButton />
      </div>
    </main>
  )
}
