'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormAlert, Submit } from '@/components/ui/form'
import { signIn, type AuthState } from '../actions'

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, { error: initialError })
  return (
    <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      <div>
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Link href="/forgot-password" className="mt-2 inline-block text-xs font-bold underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <FormAlert error={state.error} />
      <Submit pending={pending} className="mt-2">Sign in</Submit>
      <p className="text-center text-sm text-muted">
        New here?{' '}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
      <p className="text-center text-xs text-muted">
        You can also check out as a guest — no account needed.
      </p>
    </form>
  )
}
