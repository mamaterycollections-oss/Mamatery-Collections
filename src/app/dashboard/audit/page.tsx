import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import { ParamSelect } from '@/components/dash/param-select'
import { EmptyState, PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import type { Json } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Audit log' }

const ACTIONS: Record<string, string> = {
  price_change: 'Price changed',
  cost_change: 'Cost price changed',
  restock: 'Stock received',
  stock_adjustment: 'Stock adjusted',
  stock_count_completed: 'Stock count applied',
  discount_override: 'Discount given',
  order_voided: 'Order cancelled / voided',
  order_returned: 'Order returned',
  order_refunded: 'Refund recorded',
  payment_recorded: 'Payment recorded manually',
  cash_discrepancy: 'Cash discrepancy',
  role_change: 'Role changed',
  product_hidden: 'Product hidden',
  product_published: 'Product published',
}

const summarize = (v: Json | null) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  return Object.entries(v)
    .filter(([k]) => !['id', 'created_at', 'updated_at', 'user_id', 'created_by'].includes(k))
    .slice(0, 6)
    .map(([k, val]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(val) ? `${val.length} items` : String(val)}`)
    .join(' · ')
}

export default async function AuditPage({ searchParams }: PageProps<'/dashboard/audit'>) {
  await requireStaff('owner')
  const sp = await searchParams
  const action = typeof sp.action === 'string' ? sp.action : ''
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()
  let q = supabase.from('audit_log').select('*, profiles:actor_id(full_name)').order('created_at', { ascending: false })
  if (action) q = q.eq('action', action)
  const { data } = await q.range((page - 1) * 50, page * 50 - 1)

  const link = (row: { target_table: string; target_id: string | null }) =>
    row.target_table === 'orders' ? `/dashboard/orders/${row.target_id}` : row.target_table === 'products' ? `/dashboard/products/${row.target_id}` : null

  return (
    <>
      <PageHeader title="Audit log" description="Every price change, stock adjustment, discount, void, refund and permission change — who and when." actions={<ParamSelect param="action" label="Filter by action" options={[{ value: '', label: 'All actions' }, ...Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))]} />} />
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {!data?.length ? (
          <EmptyState Icon={ScrollText} title="Nothing logged yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                {data.map((r) => {
                  const href = link(r)
                  return (
                    <tr key={r.id}>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                      <td className="text-sm font-semibold">{(r.profiles as { full_name: string | null } | null)?.full_name ?? 'System'}</td>
                      <td className="text-sm">
                        <b>{ACTIONS[r.action] ?? r.action.replace(/_/g, ' ')}</b>
                        <p className="text-xs text-muted">{href ? <Link href={href} className="underline">{r.target_table}</Link> : r.target_table}</p>
                      </td>
                      <td className="max-w-64 text-xs text-muted">{summarize(r.previous_value)}</td>
                      <td className="max-w-64 text-xs">{summarize(r.new_value)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {page > 1 && <Link className="btn btn-light btn-sm" href={`?${new URLSearchParams({ ...(action && { action }), page: String(page - 1) })}`}>Newer</Link>}
        {(data?.length ?? 0) === 50 && <Link className="btn btn-light btn-sm" href={`?${new URLSearchParams({ ...(action && { action }), page: String(page + 1) })}`}>Older</Link>}
      </div>
    </>
  )
}
