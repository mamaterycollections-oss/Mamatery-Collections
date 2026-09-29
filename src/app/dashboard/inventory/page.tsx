import Link from 'next/link'
import { Boxes, Coins, PackageX, Tags } from 'lucide-react'
import { SearchBox } from '@/components/dash/search-box'
import { EmptyState, Money, PageHeader, StatCard } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cleanQuery, formatNumber } from '@/lib/utils'
import { InventoryTable } from './inventory-table'

export const metadata = { title: 'Inventory' }

export default async function InventoryPage({ searchParams }: PageProps<'/dashboard/inventory'>) {
  const { perms } = await requireStaff('manager')
  const sp = await searchParams
  const q = cleanQuery(typeof sp.q === 'string' ? sp.q : '')
  const filter = typeof sp.filter === 'string' ? sp.filter : ''
  const supabase = await createClient()

  let query = supabase
    .from('product_variants')
    .select('id, sku, barcode_value, size, colour, selling_price, quantity_on_hand, low_stock_threshold, is_active, product_id, products!inner(name, images, category_id, categories(name))')
    .eq('is_active', true)
    .order('quantity_on_hand')
  if (q) {
    const { data: prods } = await supabase.from('products').select('id').ilike('name', `%${q}%`).limit(100)
    const ids = (prods ?? []).map((p) => p.id)
    query = query.or(`sku.ilike.%${q}%,barcode_value.eq.${q.replace(/\D/g, '') || '0'}${ids.length ? `,product_id.in.(${ids.join(',')})` : ''}`)
  }
  if (filter === 'out') query = query.eq('quantity_on_hand', 0)
  const [{ data }, { data: valuation }] = await Promise.all([query.limit(500), supabase.rpc('report_stock_valuation')])
  let variants = data ?? []
  if (filter === 'low') variants = variants.filter((v) => v.quantity_on_hand <= v.low_stock_threshold)
  let costs: Record<string, number> = {}
  if (perms.margins && variants.length) {
    const { data: c } = await supabase.from('variant_costs').select('variant_id, cost_price').in('variant_id', variants.map((v) => v.id))
    costs = Object.fromEntries((c ?? []).map((x) => [x.variant_id, Number(x.cost_price)]))
  }
  const val = valuation ?? []
  const units = val.reduce((s, r) => s + Number(r.units), 0)
  const retail = val.reduce((s, r) => s + Number(r.retail_value), 0)
  const cost = perms.margins ? val.reduce((s, r) => s + Number(r.cost_value ?? 0), 0) : null

  const tab = (key: string, label: string) => (
    <Link href={`/dashboard/inventory?${new URLSearchParams({ ...(q && { q }), ...(key && { filter: key }) })}`} className={`rounded-full px-3 py-1.5 ${filter === key ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{label}</Link>
  )

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock per size/colour. Restock deliveries and record damage or losses here — every change is logged."
        actions={<><Link href="/dashboard/stock-take" className="btn btn-light btn-sm">Stock count</Link><Link href="/dashboard/labels" className="btn btn-light btn-sm"><Tags className="size-4" /> Labels</Link></>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Units in stock" value={formatNumber(units)} sub={`${val.reduce((s, r) => s + Number(r.variants), 0)} active variants`} Icon={Boxes} />
        <StatCard label="Retail value" value={<Money value={retail} />} sub="At current selling prices" Icon={Coins} />
        {cost != null ? (
          <StatCard label="Cost value" value={<Money value={cost} />} sub={retail ? `Potential profit ${Math.round(((retail - cost) / retail) * 100)}%` : undefined} Icon={Coins} tone="success" />
        ) : (
          <StatCard label="Categories" value={val.length} Icon={Tags} />
        )}
        <StatCard label="Need restock" value={(data ?? []).filter((v) => v.quantity_on_hand <= v.low_stock_threshold).length} sub="At or below alert level" Icon={PackageX} tone="warning" href="/dashboard/inventory?filter=low" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Scan barcode or search name / SKU" autoFocus />
        <div className="flex gap-1 rounded-full border border-line bg-white p-1 text-xs font-bold">
          {tab('', 'All')}
          {tab('low', 'Low & out')}
          {tab('out', 'Sold out')}
        </div>
      </div>
      {variants.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white"><EmptyState Icon={Boxes} title="Nothing matches" /></div>
      ) : (
        <InventoryTable
          margins={perms.margins}
          rows={variants.map((v) => ({
            id: v.id, sku: v.sku, barcode: v.barcode_value, label: [v.size, v.colour].filter(Boolean).join(' / '),
            name: v.products.name, image: v.products.images[0] ?? null, category: v.products.categories?.name ?? '',
            qty: v.quantity_on_hand, threshold: v.low_stock_threshold, price: Number(v.selling_price), cost: costs[v.id] ?? null, productId: v.product_id,
          }))}
        />
      )}
    </>
  )
}
