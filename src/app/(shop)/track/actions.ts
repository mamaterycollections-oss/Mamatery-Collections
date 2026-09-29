'use server'

import { redirect } from 'next/navigation'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeKePhone } from '@/lib/utils'

export async function trackOrder(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const number = String(form.get('order') ?? '').trim().toUpperCase().replace(/^#/, '')
  const phone = normalizeKePhone(String(form.get('phone') ?? ''))
  if (!/^MT\d{3,}$/.test(number) || !phone) return { error: 'Check the order number (e.g. MT1024) and phone number.' }
  if (!(await rateLimit('track', 10, 600))) return { error: 'Too many attempts. Please wait a few minutes.' }
  const { data } = await createAdminClient().from('orders').select('id, tracking_token, contact_phone').eq('order_number', number).maybeSingle()
  // Same message whether the order or the phone is wrong, so numbers can't be probed.
  if (!data || data.contact_phone !== phone) return { error: 'We couldn’t find an order with those details.' }
  redirect(`/orders/${data.id}?t=${data.tracking_token}`)
}
