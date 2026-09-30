'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionResult } from '@/components/dash/use-action'
import { requireUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, normalizeKePhone } from '@/lib/utils'

export async function updateProfile(input: { full_name: string; phone: string; marketing_opt_in: boolean }): Promise<ActionResult> {
  const session = await requireUser()
  const name = input.full_name.trim()
  if (name.length < 2) return { error: 'Enter your name' }
  const phone = input.phone.trim() ? normalizeKePhone(input.phone) : null
  if (input.phone.trim() && !phone) return { error: 'Enter a valid Kenyan phone number' }
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ full_name: name, phone, marketing_opt_in: input.marketing_opt_in }).eq('id', session.id)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/account', 'layout')
  return { ok: true, message: 'Details saved' }
}

export async function changePassword(password: string, confirm: string): Promise<ActionResult> {
  const session = await requireUser()
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }
  if (password !== confirm) return { error: 'The passwords don’t match' }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: friendlyError(error, 'Could not change the password') }
  if (session.mustChangePassword) {
    // Clear the owner-set-password reminder, then refresh so the new token no longer carries it.
    await createAdminClient().auth.admin.updateUserById(session.id, { app_metadata: { must_change_password: null } })
    await supabase.auth.refreshSession()
    revalidatePath('/', 'layout')
  }
  return { ok: true, message: 'Password changed' }
}

const addressSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().max(40).optional(),
  recipient_name: z.string().trim().min(2, 'Enter the recipient’s name').max(120),
  phone: z.string().trim(),
  zone_id: z.union([z.literal(''), z.uuid()]),
  address_line: z.string().trim().min(5, 'Enter the address').max(300),
  landmark: z.string().trim().max(200).optional(),
  is_default: z.boolean(),
})
export async function saveAddress(input: z.input<typeof addressSchema>): Promise<ActionResult> {
  const session = await requireUser()
  const p = addressSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const phone = normalizeKePhone(p.data.phone)
  if (!phone) return { error: 'Enter a valid Kenyan phone number' }
  const supabase = await createClient()
  if (p.data.is_default) await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', session.id)
  const { id, ...row } = p.data
  const values = { ...row, phone, zone_id: row.zone_id || null, label: row.label || null, landmark: row.landmark || null, user_id: session.id }
  const { error } = id ? await supabase.from('customer_addresses').update(values).eq('id', id) : await supabase.from('customer_addresses').insert(values)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/account/addresses')
  return { ok: true, message: 'Address saved' }
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/account/addresses')
  return { ok: true }
}

// Permanently deletes the customer's account and personal data (Google Play &
// Kenya Data Protection Act). Order records are kept for accounting but anonymised.
export async function deleteMyAccount(confirmText: string): Promise<ActionResult> {
  const session = await requireUser()
  if (confirmText.trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm' }
  if (session.role !== 'customer') return { error: 'Staff accounts are removed by the owner from the dashboard.' }
  if (!(await rateLimit('delete-account', 3, 3600, session.id))) return { error: 'Please try again later.' }
  const admin = createAdminClient()
  await admin
    .from('orders')
    .update({ contact_name: 'Deleted customer', contact_phone: null, contact_email: null, delivery_address: null, delivery_notes: null })
    .eq('customer_id', session.id)
  await admin.from('payments').update({ payer_phone: null }).in('order_id', ((await admin.from('orders').select('id').eq('customer_id', session.id)).data ?? []).map((o) => o.id))
  const { error } = await admin.auth.admin.deleteUser(session.id)
  if (error) return { error: 'Could not delete the account. Please contact us.' }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/delete-account?done=1')
}
