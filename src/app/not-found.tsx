import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
      <div>
        <Link href="/"><Logo /></Link>
        <p className="mt-12 font-display text-8xl text-clay italic">404</p>
        <h1 className="mt-2 font-display text-3xl">This page has moved on</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">The link may be old, or the item is no longer available. Let’s find you something new.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn btn-primary">Browse the shop</Link>
          <Link href="/" className="btn btn-light">Home</Link>
        </div>
      </div>
    </main>
  )
}
