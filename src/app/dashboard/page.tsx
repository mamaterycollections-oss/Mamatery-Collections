import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Banknote, Clock, PackageX, Percent, Receipt, ShoppingBag, Star, TrendingUp, Undo2 } from 'lucide-react'
import { BarChart } from '@/components/dash/bar-chart'
import { EmptyState, Money, PageHeader, Panel, PaymentBadge, RangePicker, StatCard, StatusBadge } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatKes, formatNumber, rangeFromPreset, timeAgo } from '@/lib/utils'

type Summary = { sales: number; orders: number; avg_order: number; items: number; discounts: number; online_orders: number; in_store_orders: number; cost: number | null; profit: number | null; margin_pct: number | null; delivery_fees: number }

export default async function OverviewPage({ searchParams }: PageProps<'/dashboard'>) {
  const { session, perms } = await requireStaff()
  const sp = await searchParams
  const range = rangeFromPreset(typeof sp.range === 'string' ? sp.range : undefined)
  const supabase = await createClient()
  const args = { p_from: range.from.toISOString(), p_to: range.to.toISOString() }

  const [summary, byDay, top, counts, recent, low] = await Promise.all([
    supabase.rpc('report_sales_summary', args),
    supabase.rpc('report_sales_by_day', args),
    supabase.rpc('report_top_products', { ...args, p_limit: 5 }),
    perms.manager ? supabase.rpc('dashboard_counts') : Promise.resolve({ data: null }),
    supabase.from('orders').select('id, order_number, contact_name, channel, status, payment_status, total, placed_at').order('placed_at', { ascending: false }).limit(8),
    perms.manager
      ? supabase.from('product_variants').select('id, sku, size, colour, quantity_on_hand, low_stock_threshold, products(name, images)').eq('is_active', true).order('quantity_on_hand').limit(40)
      : Promise.resolve({ data: [] }),
  ])
  const s = (summary.data ?? {}) as Summary
  const c = (counts.data ?? {}) as Record<string, number>
  const days = byDay.data ?? []
  const lowStock = (low.data ?? []).filter((v) => v.quantity_on_hand <= v.low_stock_threshold).slice(0, 6)
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={`${greeting}, ${(session.full_name ?? 'there').split(' ')[0]}`}
        description={perms.manager ? `Here's how the store is doing · ${range.label}` : `Your sales · ${range.label}`}
        actions={<RangePicker basePath="/dashboard" active={range.preset} />}
      />

      {perms.manager && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <ActionTile href="/dashboard/orders?tab=action" label="Orders to process" value={c.needs_action} Icon={ShoppingBag} urgent />
          <ActionTile href="/dashboard/orders?tab=unpaid" label="Awaiting payment" value={c.awaiting_payment} Icon={Clock} />
          <ActionTile href="/dashboard/inventory?filter=low" label="Low / sold out" value={(c.low_stock ?? 0) + (c.out_of_stock ?? 0)} Icon={PackageX} urgent />
          <ActionTile href="/dashboard/reviews" label="Reviews to moderate" value={c.pending_reviews} Icon={Star} />
          <ActionTile href="/dashboard/orders?tab=refunds" label="Refunds due" value={c.refunds_due} Icon={Undo2} urgent />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Sales" value={<Money value={s.sales} />} sub={`${formatNumber(s.items)} items · net of discounts`} Icon={Banknote} />
        <StatCard label="Orders" value={formatNumber(s.orders)} sub={`${s.online_orders ?? 0} online · ${s.in_store_orders ?? 0} in store`} Icon={Receipt} />
        <StatCard label="Average order" value={<Money value={s.avg_order} />} sub={s.discounts ? `${formatKes(s.discounts)} in discounts` : 'No discounts given'} Icon={TrendingUp} />
        {perms.margins ? (
          <StatCard label="Gross profit" value={<Money value={s.profit} />} sub={s.margin_pct != null ? `${s.margin_pct}% margin · cost ${formatKes(s.cost)}` : 'No sales yet'} Icon={Percent} tone="success" />
        ) : (
          <StatCard label="Items sold" value={formatNumber(s.items)} sub="Across all orders" Icon={ShoppingBag} />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title="Daily sales" action={perms.manager && <Link href="/dashboard/reports" className="text-xs font-bold text-muted hover:text-ink">Full reports →</Link>}>
          {days.some((d) => Number(d.sales) > 0) ? (
            <BarChart
              title="Daily sales"
              data={days.map((d) => ({
                label: formatDate(d.day, { day: 'numeric', month: 'short' }),
                value: Number(d.sales),
                sub: `${d.orders} order${d.orders === 1 ? '' : 's'}${d.profit != null ? ` · profit ${formatKes(d.profit)}` : ''}`,
              }))}
            />
          ) : (
            <EmptyState Icon={TrendingUp} title="No sales in this period" body="Paid orders will appear here." />
          )}
        </Panel>
        <Panel title="Best sellers" padded={false}>
          {(top.data ?? []).length ? (
            <ul className="divide-y divide-line">
              {top.data!.map((p, i) => (
                <li key={p.product_id ?? i} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-sand">
                    {p.image_url && <Image src={p.image_url} alt="" fill sizes="44px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{p.units} sold</p>
                  </div>
                  <Money value={p.sales} className="text-sm font-bold" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState Icon={ShoppingBag} title="Nothing sold yet" />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title="Recent orders" padded={false} action={<Link href="/dashboard/orders" className="text-xs font-bold text-muted hover:text-ink">All orders →</Link>}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {(recent.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-bold hover:text-clay">{o.order_number}</Link>
                      <p className="text-xs text-muted">{timeAgo(o.placed_at)} · {o.channel === 'in_store' ? 'In store' : 'Online'}</p>
                    </td>
                    <td className="max-w-40 truncate">{o.contact_name ?? '—'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td className="text-right font-semibold"><Money value={o.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {perms.manager && (
          <Panel title="Running low" padded={false} action={<Link href="/dashboard/inventory?filter=low" className="text-xs font-bold text-muted hover:text-ink">Restock →</Link>}>
            {lowStock.length ? (
              <ul className="divide-y divide-line">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <AlertTriangle className={v.quantity_on_hand === 0 ? 'size-4 text-danger' : 'size-4 text-warning'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.products?.name}</p>
                      <p className="text-xs text-muted">{[v.size, v.colour].filter(Boolean).join(' / ')} · {v.sku}</p>
                    </div>
                    <span className={v.quantity_on_hand === 0 ? 'text-sm font-bold text-danger' : 'text-sm font-bold text-warning'}>{v.quantity_on_hand}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState Icon={PackageX} title="All stocked up" />
            )}
          </Panel>
        )}
      </div>
    </>
  )
}

function ActionTile({ href, label, value, Icon, urgent }: { href: string; label: string; value?: number; Icon: typeof Clock; urgent?: boolean }) {
  const hot = urgent && (value ?? 0) > 0
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-2xl border p-4 transition hover:shadow-soft ${hot ? 'border-clay/30 bg-clay-soft' : 'border-line bg-white'}`}>
      <span className={`grid size-10 place-items-center rounded-xl ${hot ? 'bg-clay text-white' : 'bg-sand'}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl leading-none font-extrabold tabular-nums">{value ?? 0}</span>
        <span className="mt-1 block text-xs leading-tight font-semibold text-muted">{label}</span>
      </span>
      <ArrowRight className="hidden size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 sm:block" />
    </Link>
  )
}
