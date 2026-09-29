import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PosTerminal } from './pos-terminal'

export const metadata = { title: 'Quick sale' }

export default async function PosPage() {
  const { session, perms } = await requireStaff('staff')
  const supabase = await createClient()
  const { data: drawer } = await supabase.from('cash_sessions').select('id, opening_float, opened_at').eq('staff_id', session.id).eq('status', 'open').maybeSingle()
  let cashTaken = 0
  if (drawer) {
    const { data } = await supabase.from('orders').select('total').eq('cash_session_id', drawer.id).eq('payment_status', 'paid').neq('status', 'cancelled')
    cashTaken = (data ?? []).reduce((s, o) => s + Number(o.total), 0)
  }
  return (
    <PosTerminal
      drawer={drawer ? { id: drawer.id, float: Number(drawer.opening_float), taken: cashTaken, openedAt: drawer.opened_at } : null}
      discountLimit={perms.discountLimit}
      cashier={session.full_name ?? 'Staff'}
    />
  )
}
