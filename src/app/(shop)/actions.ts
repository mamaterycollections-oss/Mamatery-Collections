'use server'

import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export async function subscribeNewsletter(_: unknown, form: FormData) {
  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(form.get('email'))
  if (!parsed.success) return { error: 'Enter a valid email address' }
  if (!(await rateLimit('newsletter', 5, 3600))) return { error: 'Too many attempts. Try again later.' }
  await createAdminClient().from('newsletter_subscribers').upsert({ email: parsed.data }, { onConflict: 'email', ignoreDuplicates: true })
  return { ok: true }
}
