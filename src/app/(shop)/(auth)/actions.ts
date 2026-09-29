'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { siteUrl } from '@/lib/site-url'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { normalizeKePhone, safeNext } from '@/lib/utils'

export type AuthState = { error?: string; message?: string; fields?: Record<string, string> }

const authError = (m: string) =>
  /invalid login credentials/i.test(m) ? 'Wrong email or password.'
  : /email not confirmed/i.test(m) ? 'Please confirm your email first — check your inbox for our link.'
  : /already registered|already exists/i.test(m) ? 'An account with this email already exists. Try signing in.'
  : /rate limit|too many/i.test(m) ? 'Too many attempts. Please wait a few minutes and try again.'
  : /password/i.test(m) ? m
  : 'Something went wrong. Please try again.'

const callbackUrl = (next: string) => `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password', fields: { email } }
  if (!(await rateLimit('login', 10, 600))) return { error: 'Too many attempts. Please wait a few minutes.', fields: { email } }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: authError(error.message), fields: { email } }

  const { data: profile } = await supabase.from('profiles').select('role, staff!staff_user_id_fkey(is_active)').eq('id', data.user.id).single()
  const staff = Array.isArray(profile?.staff) ? profile.staff[0] : profile?.staff
  if (profile && profile.role !== 'customer' && profile.role !== 'owner' && !staff?.is_active) {
    await supabase.auth.signOut()
    return { error: 'This staff account has been deactivated. Please contact the owner.', fields: { email } }
  }
  const fallback = profile?.role === 'sales_attendant' ? '/dashboard/pos' : profile?.role && profile.role !== 'customer' ? '/dashboard' : '/account'
  redirect(safeNext(form.get('next'), fallback))
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizeKePhone(v)
    if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' })
    return p ?? ''
  }),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  terms: z.literal(true, { error: 'Please accept the terms and privacy policy' }),
  marketing: z.boolean(),
})

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = Object.fromEntries(['full_name', 'phone', 'email'].map((k) => [k, String(form.get(k) ?? '')]))
  const parsed = signUpSchema.safeParse({ ...fields, password: form.get('password'), terms: form.get('terms') === 'on', marketing: form.get('marketing') === 'on' })
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields }
  if (!(await rateLimit('signup', 5, 3600))) return { error: 'Too many sign-ups from this network. Try again later.', fields }

  const next = safeNext(form.get('next'), '/account')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl(next),
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone, marketing_opt_in: parsed.data.marketing },
    },
  })
  if (error) return { error: authError(error.message), fields }
  if (data.session) redirect(next)
  return { message: `Almost there! We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.` }
}

export async function forgotPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.string().trim().toLowerCase().email('Enter a valid email address').safeParse(form.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('forgot', 5, 3600))) return { error: 'Too many requests. Try again later.' }
  // Implicit flow: the link carries the session itself, so it works on any device that opens the email.
  const { error } = await createPublicClient().auth.resetPasswordForEmail(parsed.data, { redirectTo: `${siteUrl()}/reset-password` })
  if (error && /rate limit/i.test(error.message)) return { error: authError(error.message) }
  return { message: `If an account exists for ${parsed.data}, we've emailed a link to choose a new password. It works once and expires soon.` }
}

export async function setNewPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }
  if (password !== form.get('confirm')) return { error: 'The passwords don’t match' }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: authError(error.message) }
  redirect('/account?password=updated')
}
