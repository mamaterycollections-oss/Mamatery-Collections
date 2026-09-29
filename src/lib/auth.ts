import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/database.types'

export type Role = Enums<'app_role'>

export type Session = {
  id: string
  role: Role
  full_name: string | null
  email: string | null
  phone: string | null
  staff: {
    is_active: boolean
    can_view_margins: boolean
    discount_limit_pct: number
    assigned_category_ids: string[]
  } | null
}

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, phone, staff(is_active, can_view_margins, discount_limit_pct, assigned_category_ids)')
    .eq('id', userId)
    .single()
  if (!profile) return null
  const staff = Array.isArray(profile.staff) ? profile.staff[0] : profile.staff
  return { ...profile, staff: staff ?? null }
})

// What each signed-in person may do in the dashboard. The database enforces
// the same rules; this only decides what to show.
export function permissionsFor(s: Session) {
  const owner = s.role === 'owner'
  const activeStaff = owner || (s.role !== 'customer' && Boolean(s.staff?.is_active))
  const manager = owner || (s.role === 'sales_manager' && Boolean(s.staff?.is_active))
  return {
    owner,
    staff: activeStaff,
    manager,
    margins: owner || (manager && Boolean(s.staff?.can_view_margins)),
    discountLimit: owner ? 100 : Number(s.staff?.discount_limit_pct ?? 0),
    categories: owner ? [] : (s.staff?.assigned_category_ids ?? []),
  }
}
export type Permissions = ReturnType<typeof permissionsFor>

export const isStaffRole = (role: Role) => role !== 'customer'

export function homeFor(s: Session) {
  return permissionsFor(s).staff ? (s.role === 'sales_attendant' ? '/dashboard/pos' : '/dashboard') : '/account'
}

export async function requireUser(next = '/account') {
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`)
  return session
}

export async function requireStaff(level: 'staff' | 'manager' | 'owner' | 'margins' = 'staff') {
  const session = await getSession()
  if (!session) redirect('/login?next=/dashboard')
  const p = permissionsFor(session)
  if (!p.staff) redirect('/account')
  if (!p[level]) redirect(session.role === 'sales_attendant' ? '/dashboard/pos' : '/dashboard')
  return { session, perms: p }
}
