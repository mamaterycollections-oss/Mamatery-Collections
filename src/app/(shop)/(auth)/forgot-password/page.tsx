'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormAlert, Submit } from '@/components/ui/form'
import { forgotPassword, type AuthState } from '../actions'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPassword, {})
  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-md animate-fade-up">
        <p className="eyebrow">Account help</p>
        <h1 className="mt-2 font-display text-4xl">Reset your password</h1>
        <p className="mt-3 text-muted">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
        <form action={action} className="mt-8 grid gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <FormAlert error={state.error} message={state.message} />
          <Submit pending={pending}>Send reset link</Submit>
          <Link href="/login" className="text-center text-sm font-bold underline underline-offset-4">Back to sign in</Link>
        </form>
      </div>
    </div>
  )
}
