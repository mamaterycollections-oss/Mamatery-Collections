import type { Metadata } from 'next'
import { DashShell } from '@/components/dash/shell'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABEL } from '@/lib/utils'

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s · Dashboard' }, robots: { index: false } }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, perms } = await requireStaff()
  const supabase = await createClient()
  const [{ count: unread }, { data: counts }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.id).is('read_at', null),
    perms.manager ? supabase.rpc('dashboard_counts') : Promise.resolve({ data: null }),
  ])
  const c = (counts ?? {}) as Record<string, number>
  return (
    <DashShell
      user={{ id: session.id, name: session.full_name ?? session.email ?? 'Staff', role: ROLE_LABEL[session.role] }}
      perms={perms}
      unread={unread ?? 0}
      badges={{ orders: c.needs_action ?? 0, reviews: c.pending_reviews ?? 0, inventory: (c.low_stock ?? 0) + (c.out_of_stock ?? 0) }}
    >
      {children}
    </DashShell>
  )
}
