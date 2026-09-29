'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { Field, FormAlert, Submit } from '@/components/ui/form'
import { signUp, type AuthState } from '../actions'

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {})
  if (state.message) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 rounded-3xl bg-success-soft p-6 text-success">
        <MailCheck className="size-8" />
        <p className="mt-3 font-bold">Check your inbox</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </motion.div>
    )
  }
  return (
    <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" name="full_name" autoComplete="name" required defaultValue={state.fields?.full_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone (M-Pesa)" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" required defaultValue={state.fields?.phone} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      </div>
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-1 size-4 accent-ink" />
        <span className="text-muted">
          I agree to the <Link href="/terms" className="font-semibold text-ink underline">Terms</Link> and{' '}
          <Link href="/privacy" className="font-semibold text-ink underline">Privacy Policy</Link>.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="marketing" className="mt-1 size-4 accent-ink" />
        <span className="text-muted">Send me new arrivals and offers (optional, unsubscribe anytime).</span>
      </label>
      <FormAlert error={state.error} />
      <Submit pending={pending} className="mt-2">Create account</Submit>
      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </form>
  )
}
