import Link from 'next/link'
import { Download, Lock } from 'lucide-react'
import { BarChart, HBarList } from '@/components/dash/bar-chart'
import { ParamSelect } from '@/components/dash/param-select'
import { EmptyState, Money, PageHeader, Panel, RangePicker, StatCard, Tabs } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatKes, formatNumber, rangeFromPreset } from '@/lib/utils'

export const metadata = { title: 'Reports' }

export default async function ReportsPage({ searchParams }: PageProps<'/dashboard/reports'>) {
  const { perms } = await requireStaff('manager')
  const sp = await searchParams
  const tab = typeof sp.tab === 'string' ? sp.tab : perms.margins ? 'profit' : 'sales'
  const group = typeof sp.group === 'string' && ['product', 'category', 'variant'].includes(sp.group) ? sp.group : 'product'
  const category = typeof sp.category === 'string' ? sp.category : ''
  const range = rangeFromPreset(typeof sp.range === 'string' ? sp.range : undefined)
  const args = { p_from: range.from.toISOString(), p_to: range.to.toISOString() }
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('sort_order')
  const q = (extra: Record<string, string>) => `/dashboard/reports?${new URLSearchParams({ tab, range: range.preset, group, ...(category && { category }), ...extra })}`

  const tabs = [
    ...(perms.margins ? [{ key: 'profit', label: 'Profit & margins', href: q({ tab: 'profit' }) }] : []),
    { key: 'sales', label: 'Sales', href: q({ tab: 'sales' }) },
    { key: 'stock', label: 'Stock value', href: q({ tab: 'stock' }) },
  ]

  return (
    <>
      <PageHeader title="Reports" description={range.label} actions={tab !== 'stock' && <RangePicker basePath="/dashboard/reports" active={range.preset} extra={{ tab, group, ...(category && { category }) }} />} />
      <Tabs tabs={tabs} active={tab} />
      {tab === 'profit' && perms.margins && <ProfitReport args={args} group={group} category={category} categories={categories ?? []} q={q} rangeKey={range.preset} />}
      {tab === 'profit' && !perms.margins && <EmptyState Icon={Lock} title="Profit reports are restricted" body="Ask the owner to give you margin access." />}
      {tab === 'sales' && <SalesReport args={args} />}
      {tab === 'stock' && <StockReport margins={perms.margins} />}
    </>
  )
}

async function ProfitReport({ args, group, category, categories, q, rangeKey }: { args: { p_from: string; p_to: string }; group: string; category: string; categories: { id: string; name: string }[]; q: (e: Record<string, string>) => string; rangeKey: string }) {
  const supabase = await createClient()
  const [{ data: rows, error }, { data: summary }, { data: byCat }] = await Promise.all([
    supabase.rpc('report_profit', { ...args, p_group: group, ...(category && { p_category: category }) }),
    supabase.rpc('report_sales_summary', args),
    supabase.rpc('report_profit', { ...args, p_group: 'category' }),
  ])
  if (error) return <EmptyState Icon={Lock} title="Couldn’t load the report" body={error.message} />
  const s = (summary ?? {}) as Record<string, number | null>
  const list = rows ?? []
  const exportHref = `/dashboard/reports/export?${new URLSearchParams({ type: 'profit', group, range: rangeKey, ...(category && { category }) })}`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Net sales" value={<Money value={s.sales} />} sub="After discounts, excl. delivery" />
        <StatCard label="Cost of goods" value={<Money value={s.cost} />} />
        <StatCard label="Gross profit" value={<Money value={s.profit} />} tone="success" />
        <StatCard label="Margin" value={s.margin_pct != null ? `${s.margin_pct}%` : '—'} sub={`${formatNumber(Number(s.items ?? 0))} items sold`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel
          padded={false}
          title={
            <span className="flex flex-wrap items-center gap-1 text-xs">
              {(['product', 'category', 'variant'] as const).map((g) => (
                <Link key={g} href={q({ group: g })} className={`rounded-full px-3 py-1.5 font-bold ${group === g ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
                  By {g === 'variant' ? 'size/colour' : g}
                </Link>
              ))}
            </span>
          }
          action={
            <span className="flex items-center gap-2">
              <ParamSelect param="category" label="Category filter" options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              <a href={exportHref} className="btn btn-light btn-sm"><Download className="size-4" /> CSV</a>
            </span>
          }
        >
          {list.length === 0 ? (
            <EmptyState Icon={Lock} title="No paid sales in this period" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>{group === 'category' ? 'Category' : 'Item'}</th><th className="text-right">Units</th><th className="text-right">Sales</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.key}>
                      <td><p className="font-semibold">{r.label}</p>{group !== 'category' && r.category && <p className="text-xs text-muted">{r.category}</p>}</td>
                      <td className="text-right">{r.units}</td>
                      <td className="text-right"><Money value={r.sales} /></td>
                      <td className="text-right text-muted"><Money value={r.cost} /></td>
                      <td className="text-right font-bold"><Money value={r.profit} /></td>
                      <td className="text-right">
                        <span className={`chip ${Number(r.margin_pct) >= 40 ? 'bg-success-soft text-success' : Number(r.margin_pct) >= 20 ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'}`}>{r.margin_pct ?? '—'}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Profit by category">
          <HBarList rows={(byCat ?? []).map((r) => ({ label: r.label ?? '', value: Number(r.profit), note: r.margin_pct != null ? `${r.margin_pct}%` : undefined }))} />
        </Panel>
      </div>
    </div>
  )
}

async function SalesReport({ args }: { args: { p_from: string; p_to: string } }) {
  const supabase = await createClient()
  const [{ data: days }, { data: top }, { data: summary }] = await Promise.all([
    supabase.rpc('report_sales_by_day', args),
    supabase.rpc('report_top_products', { ...args, p_limit: 15 }),
    supabase.rpc('report_sales_summary', args),
  ])
  const s = (summary ?? {}) as Record<string, number>
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Net sales" value={<Money value={s.sales} />} />
        <StatCard label="Orders" value={formatNumber(s.orders)} sub={`${s.online_orders} online · ${s.in_store_orders} in store`} />
        <StatCard label="Average order" value={<Money value={s.avg_order} />} />
        <StatCard label="Delivery fees collected" value={<Money value={s.delivery_fees} />} sub={`Discounts given ${formatKes(s.discounts)}`} />
      </div>
      <Panel title="Sales per day">
        <BarChart title="Sales per day" data={(days ?? []).map((d) => ({ label: formatDate(d.day, { day: 'numeric', month: 'short' }), value: Number(d.sales), sub: `${d.orders} orders` }))} />
      </Panel>
      <Panel title="Top products" padded={false}>
        <table className="table">
          <thead><tr><th>#</th><th>Product</th><th className="text-right">Units</th><th className="text-right">Sales</th></tr></thead>
          <tbody>
            {(top ?? []).map((p, i) => (
              <tr key={p.product_id ?? i}><td className="text-muted">{i + 1}</td><td className="font-semibold">{p.name}</td><td className="text-right">{p.units}</td><td className="text-right font-bold"><Money value={p.sales} /></td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

async function StockReport({ margins }: { margins: boolean }) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('report_stock_valuation')
  const rows = data ?? []
  const retail = rows.reduce((s, r) => s + Number(r.retail_value), 0)
  const cost = rows.reduce((s, r) => s + Number(r.cost_value ?? 0), 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard label="Units on hand" value={formatNumber(rows.reduce((s, r) => s + Number(r.units), 0))} />
        <StatCard label="Retail value" value={<Money value={retail} />} sub="If everything sells at current prices" />
        {margins && <StatCard label="Cost value" value={<Money value={cost} />} sub={`Potential gross profit ${formatKes(retail - cost)}`} tone="success" />}
      </div>
      <Panel title="By category" padded={false} action={<a href="/dashboard/reports/export?type=stock" className="btn btn-light btn-sm"><Download className="size-4" /> CSV</a>}>
        <table className="table">
          <thead><tr><th>Category</th><th className="text-right">Variants</th><th className="text-right">Units</th>{margins && <th className="text-right">Cost value</th>}<th className="text-right">Retail value</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category_id}><td className="font-semibold">{r.category}</td><td className="text-right">{r.variants}</td><td className="text-right">{r.units}</td>{margins && <td className="text-right"><Money value={r.cost_value} /></td>}<td className="text-right font-bold"><Money value={r.retail_value} /></td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
