import { UserRound } from 'lucide-react'
import { SearchBox } from '@/components/dash/search-box'
import { EmptyState, Money, PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { whatsappLink } from '@/lib/store'
import { createClient } from '@/lib/supabase/server'
import { cleanQuery, formatDate } from '@/lib/utils'

export const metadata = { title: 'Customers' }

// Registered customers plus guest buyers (grouped by phone), with lifetime spend.
export default async function CustomersPage({ searchParams }: PageProps<'/dashboard/customers'>) {
  await requireStaff('manager')
  const sp = await searchParams
  const q = cleanQuery(typeof sp.q === 'string' ? sp.q : '')
  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('customer_id, contact_name, contact_phone, contact_email, total, placed_at, payment_status, status')
    .eq('channel', 'online')
    .order('placed_at', { ascending: false })
  if (q) query = query.or(`contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%,contact_email.ilike.%${q}%`)
  const [{ data: orders }, { data: profiles }] = await Promise.all([
    query.limit(2000),
    supabase.from('profiles').select('id, full_name, email, phone, created_at, marketing_opt_in').eq('role', 'customer').order('created_at', { ascending: false }).limit(500),
  ])

  type C = { key: string; name: string; phone: string | null; email: string | null; registered: boolean; optIn: boolean; orders: number; spend: number; last: string | null; since: string | null }
  const map = new Map<string, C>()
  for (const p of profiles ?? []) {
    map.set(p.id, { key: p.id, name: p.full_name ?? '—', phone: p.phone, email: p.email, registered: true, optIn: p.marketing_opt_in, orders: 0, spend: 0, last: null, since: p.created_at })
  }
  for (const o of orders ?? []) {
    const key = o.customer_id ?? `guest:${o.contact_phone}`
    const c = map.get(key) ?? { key, name: o.contact_name ?? '—', phone: o.contact_phone, email: o.contact_email, registered: false, optIn: false, orders: 0, spend: 0, last: null, since: null }
    if (o.payment_status === 'paid' && !['cancelled', 'returned'].includes(o.status)) {
      c.orders += 1
      c.spend += Number(o.total)
    }
    c.last = c.last && c.last > o.placed_at ? c.last : o.placed_at
    map.set(key, c)
  }
  let list = [...map.values()]
  if (q) list = list.filter((c) => [c.name, c.phone, c.email].some((x) => x?.toLowerCase().includes(q.toLowerCase())))
  list.sort((a, b) => b.spend - a.spend)

  return (
    <>
      <PageHeader title="Customers" description={`${list.length} customers · sorted by lifetime spend`} />
      <div className="mb-4"><SearchBox placeholder="Search name, phone or email" /></div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {!list.length ? (
          <EmptyState Icon={UserRound} title="No customers yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Customer</th><th>Contact</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Last order</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 300).map((c) => {
                  const wa = whatsappLink(c.phone)
                  return (
                    <tr key={c.key}>
                      <td>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted">{c.registered ? `Account since ${formatDate(c.since)}` : 'Guest checkout'}{c.optIn ? ' · subscribed' : ''}</p>
                      </td>
                      <td className="text-xs">{c.phone}<br /><span className="text-muted">{c.email}</span></td>
                      <td className="text-right">{c.orders}</td>
                      <td className="text-right font-bold"><Money value={c.spend} /></td>
                      <td className="text-xs text-muted">{c.last ? formatDate(c.last) : '—'}</td>
                      <td className="text-right">{wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-light btn-sm">WhatsApp</a>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
