import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { getSession, homeFor } from '@/lib/auth'
import { safeNext } from '@/lib/utils'
import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Create account', robots: { index: false } }

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const sp = await searchParams
  const next = typeof sp.next === 'string' ? safeNext(sp.next, '') : ''
  const session = await getSession()
  if (session) redirect(next || homeFor(session))
  return (
    <AuthShell>
      <p className="eyebrow">Join MamaTerry</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Create your account</h1>
      <p className="mt-3 text-muted">Faster checkout, order tracking and early access to new drops.</p>
      <SignupForm next={next} />
    </AuthShell>
  )
}
