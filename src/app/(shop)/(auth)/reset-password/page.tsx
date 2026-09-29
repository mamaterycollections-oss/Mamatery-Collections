'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Field, FormAlert, Submit } from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { setNewPassword, type AuthState } from '../actions'

type View = 'checking' | 'ready' | 'expired'

// Reset links arrive as #access_token=…&type=recovery (implicit flow, works on any device),
// or after /auth/callback has already signed the user in.
export default function ResetPasswordPage() {
  const [view, setView] = useState<View>('checking')
  const [fragment] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.slice(1)))
  const [state, action, pending] = useActionState<AuthState, FormData>(setNewPassword, {})

  useEffect(() => {
    const params = new URLSearchParams(fragment)
    if (params.has('access_token') || params.has('error')) window.history.replaceState(null, '', window.location.pathname)
    const supabase = createClient()
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token && params.get('type') === 'recovery') {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => setView(error ? 'expired' : 'ready'))
    } else {
      supabase.auth.getUser().then(({ data }) => setView(data.user && !params.has('error') ? 'ready' : 'expired'))
    }
  }, [fragment])

  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-md">
        {view === 'checking' && (
          <p className="flex items-center gap-2 text-muted"><Loader2 className="size-5 animate-spin" /> Checking your link…</p>
        )}
        {view === 'expired' && (
          <>
            <h1 className="font-display text-4xl">This link has expired</h1>
            <p className="mt-3 text-muted">Reset links work once and only for a short time. Request a new one and use it straight away.</p>
            <Link href="/forgot-password" className="btn btn-primary btn-lg mt-8 w-full">Send a new link</Link>
          </>
        )}
        {view === 'ready' && (
          <>
            <h1 className="font-display text-4xl">Choose a new password</h1>
            <form action={action} className="mt-8 grid gap-4">
              <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" />
              <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
              <FormAlert error={state.error} />
              <Submit pending={pending}>Save new password</Submit>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
