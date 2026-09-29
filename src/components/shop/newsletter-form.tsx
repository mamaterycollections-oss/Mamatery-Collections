'use client'

import { useActionState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { subscribeNewsletter } from '@/app/(shop)/actions'

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, null)
  if (state?.ok) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-gold">
        <Check className="size-4" /> You&apos;re on the list — thank you!
      </p>
    )
  }
  return (
    <form action={action} className="mt-4">
      <div className="flex overflow-hidden rounded-full border border-paper/20 focus-within:border-gold">
        <input
          name="email"
          type="email"
          required
          placeholder="Your email"
          aria-label="Email address"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-paper/40"
        />
        <button className="grid w-12 place-items-center bg-paper text-ink transition hover:bg-gold" aria-label="Subscribe" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}
    </form>
  )
}
