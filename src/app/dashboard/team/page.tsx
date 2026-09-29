import { Award } from 'lucide-react'
import { EmptyState, Money, PageHeader, Panel, RangePicker } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, rangeFromPreset, ROLE_LABEL } from '@/lib/utils'
import { TeamManager } from './team-manager'

export const metadata = { title: 'Team' }

export default async function TeamPage({ searchParams }: PageProps<'/dashboard/team'>) {
  const { perms } = await requireStaff('staff')
  const sp = await searchParams
  const range = rangeFromPreset(typeof sp.range === 'string' ? sp.range : undefined)
  const supabase = await createClient()
  const [{ data: perf }, staff, { data: categories }] = await Promise.all([
    supabase.rpc('report_staff_performance', { p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
    perms.owner
      ? supabase.from('staff').select('user_id, assigned_category_ids, can_view_margins, discount_limit_pct, is_active, created_at, profiles!staff_user_id_fkey(full_name, email, phone, role)').order('created_at')
      : Promise.resolve({ data: null }),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])
  const rows = perf ?? []
  const best = rows.filter((r) => Number(r.sales) > 0)[0]

  return (
    <>
      <PageHeader
        title="Team"
        description={perms.owner ? 'Performance for appraisals, and who can do what.' : perms.manager ? 'Your and your team’s performance' : 'Your performance'}
        actions={<RangePicker basePath="/dashboard/team" active={range.preset} />}
      />
      <Panel title={`Performance · ${range.label}`} padded={false} className="mb-6">
        {rows.length === 0 ? (
          <EmptyState Icon={Award} title="No staff yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Staff</th><th className="text-right">Sales</th><th className="text-right">Orders</th><th className="text-right">Avg order</th><th className="text-right">Items</th><th className="text-right">Voided sales</th><th className="text-right">Voids done</th><th className="text-right">Discounts</th><th>Last sale</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td>
                      <p className="flex items-center gap-2 font-semibold">{r.full_name ?? 'Staff'} {best?.user_id === r.user_id && <span className="chip bg-gold/20 text-[#8a6a2a]"><Award className="size-3" /> Top</span>}</p>
                      <p className="text-xs text-muted">{r.role ? ROLE_LABEL[r.role] : ''}{r.is_active === false ? ' · inactive' : ''}</p>
                    </td>
                    <td className="text-right font-bold"><Money value={r.sales} /></td>
                    <td className="text-right">{r.orders}</td>
                    <td className="text-right"><Money value={r.avg_order} /></td>
                    <td className="text-right">{r.items}</td>
                    <td className={`text-right ${Number(r.voided_sales) > 0 ? 'font-bold text-danger' : 'text-muted'}`}>{r.voided_sales}</td>
                    <td className="text-right text-muted">{r.voids_performed}</td>
                    <td className="text-right text-muted"><Money value={r.discounts} /></td>
                    <td className="text-xs text-muted">{r.last_sale ? formatDateTime(r.last_sale) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-muted">Sales are paid orders the person handled (in-store sales they rang up, online orders they processed), net of discounts. “Voided sales” are their sales later cancelled; “Voids done” are cancellations they performed.</p>
      </Panel>

      {perms.owner && staff.data && (
        <TeamManager
          categories={categories ?? []}
          staff={staff.data.map((s) => ({
            userId: s.user_id, name: s.profiles?.full_name ?? '', email: s.profiles?.email ?? '', phone: s.profiles?.phone ?? '',
            role: (s.profiles?.role ?? 'sales_attendant') as 'sales_manager' | 'sales_attendant', categories: s.assigned_category_ids,
            margins: s.can_view_margins, discount: Number(s.discount_limit_pct), active: s.is_active,
          }))}
        />
      )}
    </>
  )
}
