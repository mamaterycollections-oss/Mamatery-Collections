'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, normalizeKePhone } from '@/lib/utils'

const tempPassword = () => `Mt-${randomBytes(5).toString('base64url')}${Math.floor(Math.random() * 90 + 10)}`

const staffSchema = z.object({
  role: z.enum(['sales_manager', 'sales_attendant']),
  assigned_category_ids: z.array(z.uuid()).max(50),
  can_view_margins: z.boolean(),
  discount_limit_pct: z.coerce.number().min(0).max(100),
})

const newSchema = staffSchema.extend({
  full_name: z.string().trim().min(2, 'Enter their name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().optional(),
})

export async function createStaff(input: z.input<typeof newSchema>): Promise<ActionResult<{ password: string | null; existing: boolean }>> {
  const { session } = await requireStaff('owner')
  const p = newSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const v = p.data
  const phone = v.phone ? normalizeKePhone(v.phone) : null
  if (v.phone && !phone) return { error: 'Phone number looks wrong' }

  const admin = createAdminClient()
  const supabase = await createClient()
  // An existing customer account can be promoted to staff.
  const { data: existing } = await admin.from('profiles').select('id, role').eq('email', v.email).maybeSingle()
  if (existing?.role === 'owner') return { error: 'That email belongs to the owner account' }
  let userId = existing?.id
  let password: string | null = null
  if (!userId) {
    password = tempPassword()
    const { data, error } = await admin.auth.admin.createUser({ email: v.email, password, email_confirm: true, user_metadata: { full_name: v.full_name, phone } })
    if (error) return { error: friendlyError(error, 'Could not create the login') }
    userId = data.user.id
  }
  const { error: pe } = await supabase.from('profiles').update({ role: v.role, full_name: v.full_name, ...(phone && { phone }) }).eq('id', userId)
  if (pe) return { error: friendlyError(pe) }
  const { error: se } = await supabase.from('staff').upsert({
    user_id: userId, assigned_category_ids: v.role === 'sales_manager' ? v.assigned_category_ids : [],
    can_view_margins: v.role === 'sales_manager' && v.can_view_margins, discount_limit_pct: v.discount_limit_pct, is_active: true, created_by: session.id,
  })
  if (se) return { error: friendlyError(se) }
  await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  revalidatePath('/dashboard/team')
  return { ok: true, data: { password, existing: Boolean(existing) } }
}

export async function updateStaff(userId: string, input: z.input<typeof staffSchema>): Promise<ActionResult> {
  await requireStaff('owner')
  const p = staffSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const v = p.data
  const supabase = await createClient()
  const { error: pe } = await supabase.from('profiles').update({ role: v.role }).eq('id', userId)
  if (pe) return { error: friendlyError(pe) }
  const { error } = await supabase.from('staff').update({
    assigned_category_ids: v.role === 'sales_manager' ? v.assigned_category_ids : [],
    can_view_margins: v.role === 'sales_manager' && v.can_view_margins,
    discount_limit_pct: v.discount_limit_pct,
  }).eq('user_id', userId)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/team')
  return { ok: true, message: 'Permissions updated' }
}

// Deactivating also blocks sign-in immediately (history and performance are kept).
export async function setStaffActive(userId: string, active: boolean): Promise<ActionResult> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ is_active: active }).eq('user_id', userId)
  if (error) return { error: friendlyError(error) }
  await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })
  revalidatePath('/dashboard/team')
  return { ok: true, message: active ? 'Staff member re-activated' : 'Staff member deactivated — they can no longer sign in' }
}

export async function resetStaffPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { data } = await supabase.from('staff').select('user_id').eq('user_id', userId).maybeSingle()
  if (!data) return { error: 'Not a staff member' }
  const password = tempPassword()
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password })
  if (error) return { error: friendlyError(error) }
  return { ok: true, data: { password } }
}
