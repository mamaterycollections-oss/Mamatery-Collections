'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])
  return (
    <main className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-4xl">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">Please try again. If it keeps happening, contact us and mention code {error.digest ?? 'N/A'}.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-light">Home</Link>
        </div>
      </div>
    </main>
  )
}
