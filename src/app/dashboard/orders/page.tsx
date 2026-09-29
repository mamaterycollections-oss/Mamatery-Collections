import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { SearchBox } from '@/components/dash/search-box'
import { EmptyState, Money, PageHeader, PaymentBadge, StatusBadge, Tabs } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cleanQuery, formatDateTime, PAYMENT_METHOD_LABEL } from '@/lib/utils'

export const metadata = { title: 'Orders' }
const PAGE = 30

export default async function OrdersPage({ searchParams }: PageProps<'/dashboard/orders'>) {
  const { perms } = await requireStaff()
  const sp = await searchParams
  const tab = typeof sp.tab === 'string' ? sp.tab : perms.manager ? 'action' : 'all'
  const q = cleanQuery(typeof sp.q === 'string' ? sp.q : '')
  const channel = typeof sp.channel === 'string' ? sp.channel : ''
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select('id, order_number, channel, contact_name, contact_phone, status, payment_status, payment_method, delivery_method, delivery_zone_name, total, placed_at, order_items(quantity)', { count: 'exact' })
  switch (tab) {
    case 'action':
      query = query.eq('channel', 'online').in('status', ['placed', 'confirmed', 'packed']).or('payment_status.eq.paid,payment_method.eq.cod')
      break
    case 'unpaid':
      query = query.eq('status', 'placed').in('payment_status', ['pending', 'unpaid', 'failed']).neq('payment_method', 'cod')
      break
    case 'transit':
      query = query.in('status', ['out_for_delivery', 'ready_for_pickup'])
      break
    case 'done':
      query = query.in('status', ['delivered', 'collected'])
      break
    case 'refunds':
      query = query.in('status', ['cancelled', 'returned']).eq('payment_status', 'paid')
      break
    case 'cancelled':
      query = query.in('status', ['cancelled', 'returned'])
      break
  }
  if (channel === 'online' || channel === 'in_store') query = query.eq('channel', channel)
  if (q) query = query.or(`order_number.ilike.%${q}%,contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%`)
  const { data, count } = await query.order('placed_at', { ascending: tab === 'action' }).range((page - 1) * PAGE, page * PAGE - 1)
  const orders = data ?? []
  const counts = perms.manager ? (((await supabase.rpc('dashboard_counts')).data ?? {}) as Record<string, number>) : {}

  const href = (t: string) => `/dashboard/orders?${new URLSearchParams({ tab: t, ...(q && { q }), ...(channel && { channel }) })}`
  const tabs = [
    ...(perms.manager
      ? [
          { key: 'action', label: 'To process', href: href('action'), count: counts.needs_action },
          { key: 'unpaid', label: 'Awaiting payment', href: href('unpaid'), count: counts.awaiting_payment },
          { key: 'transit', label: 'Out / ready', href: href('transit'), count: counts.in_transit },
          { key: 'done', label: 'Completed', href: href('done') },
          { key: 'refunds', label: 'Refunds due', href: href('refunds'), count: counts.refunds_due },
          { key: 'cancelled', label: 'Cancelled', href: href('cancelled') },
        ]
      : []),
    { key: 'all', label: 'All', href: href('all') },
  ]

  return (
    <>
      <PageHeader title="Orders" description={perms.manager ? 'Online orders and in-store sales' : 'Sales you have rung up'} />
      <Tabs tabs={tabs} active={tab} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Search order no., name or phone" />
        <div className="flex gap-1 rounded-full border border-line bg-white p-1 text-xs font-bold">
          {[['', 'All channels'], ['online', 'Online'], ['in_store', 'In store']].map(([k, label]) => (
            <Link key={k} href={`/dashboard/orders?${new URLSearchParams({ tab, ...(q && { q }), ...(k && { channel: k }) })}`} className={`rounded-full px-3 py-1.5 ${channel === k ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {orders.length === 0 ? (
          <EmptyState Icon={ShoppingBag} title={tab === 'action' ? 'All caught up!' : 'No orders here'} body={tab === 'action' ? 'New paid orders will appear here for you to confirm and pack.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Items</th><th>Fulfilment</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer">
                    <td>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-bold hover:text-clay">{o.order_number}</Link>
                      <p className="text-xs text-muted">{formatDateTime(o.placed_at)}</p>
                    </td>
                    <td>
                      <p className="max-w-44 truncate font-semibold">{o.contact_name ?? '—'}</p>
                      <p className="text-xs text-muted">{o.contact_phone}</p>
                    </td>
                    <td>{o.order_items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="text-xs">{o.channel === 'in_store' ? 'In store' : o.delivery_method === 'pickup' ? 'Pickup' : o.delivery_zone_name ?? 'Delivery'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <PaymentBadge status={o.payment_status} />
                      <p className="mt-0.5 text-[0.7rem] text-muted">{PAYMENT_METHOD_LABEL[o.payment_method]}</p>
                    </td>
                    <td className="text-right font-bold"><Money value={o.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(count ?? 0) > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {page} of {Math.ceil((count ?? 0) / PAGE)}</p>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn btn-light btn-sm" href={`${href(tab)}&page=${page - 1}`}>Previous</Link>}
            {page * PAGE < (count ?? 0) && <Link className="btn btn-light btn-sm" href={`${href(tab)}&page=${page + 1}`}>Next</Link>}
          </div>
        </div>
      )}
    </>
  )
}
