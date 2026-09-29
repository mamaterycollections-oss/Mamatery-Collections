import { Wallet } from 'lucide-react'
import { EmptyState, Money, PageHeader, Panel } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { DrawerControls } from './drawer-controls'

export const metadata = { title: 'Cash drawer' }

export default async function CashPage() {
  const { session, perms } = await requireStaff('staff')
  const supabase = await createClient()
  const [{ data: sessions }, { data: mine }] = await Promise.all([
    supabase.from('cash_sessions').select('*, profiles:staff_id(full_name)').order('opened_at', { ascending: false }).limit(60),
    supabase.from('cash_sessions').select('id, opening_float, opened_at').eq('staff_id', session.id).eq('status', 'open').maybeSingle(),
  ])
  let expected: number | null = null
  let sales = 0
  if (mine) {
    const { data } = await supabase.from('orders').select('total').eq('cash_session_id', mine.id).eq('payment_status', 'paid').not('status', 'in', '(cancelled,returned)')
    sales = (data ?? []).reduce((s, o) => s + Number(o.total), 0)
    expected = Number(mine.opening_float) + sales
  }
  return (
    <>
      <PageHeader title="Cash drawer" description="Open your drawer before taking cash; count it at the end of your shift. Differences are reported to the owner." />
      <Panel title="Your drawer" className="mb-6">
        <DrawerControls session={mine ? { id: mine.id, float: Number(mine.opening_float), openedAt: mine.opened_at, sales, expected: expected! } : null} />
      </Panel>
      <Panel title={perms.manager ? 'All drawer sessions' : 'Your past sessions'} padded={false}>
        {!sessions?.length ? (
          <EmptyState Icon={Wallet} title="No drawer sessions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Staff</th><th>Opened</th><th>Closed</th><th className="text-right">Float</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="text-right">Difference</th></tr></thead>
              <tbody>
                {sessions.map((s) => {
                  const d = s.discrepancy == null ? null : Number(s.discrepancy)
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold">{(s.profiles as { full_name: string | null } | null)?.full_name ?? 'Staff'}</td>
                      <td className="text-xs">{formatDateTime(s.opened_at)}</td>
                      <td className="text-xs">{s.closed_at ? formatDateTime(s.closed_at) : <span className="chip bg-info-soft text-info">Open</span>}</td>
                      <td className="text-right"><Money value={s.opening_float} /></td>
                      <td className="text-right"><Money value={s.expected_cash} /></td>
                      <td className="text-right"><Money value={s.counted_cash} /></td>
                      <td className={`text-right font-bold ${d == null ? '' : Math.abs(d) < 1 ? 'text-success' : 'text-danger'}`}>
                        {d == null ? '—' : Math.abs(d) < 1 ? 'Balanced' : <>{d < 0 ? 'Short ' : 'Over '}<Money value={Math.abs(d)} /></>}
                        {s.notes && <p className="text-[0.7rem] font-normal text-muted">{s.notes}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
