import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { getSession, homeFor } from '@/lib/auth'
import { safeNext } from '@/lib/utils'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = typeof sp.next === 'string' ? safeNext(sp.next, '') : ''
  const session = await getSession()
  if (session) redirect(next || homeFor(session))
  return (
    <AuthShell>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Sign in</h1>
      <p className="mt-3 text-muted">Track orders, save addresses and check out faster.</p>
      <LoginForm next={next} initialError={typeof sp.error === 'string' ? sp.error : undefined} />
    </AuthShell>
  )
}
