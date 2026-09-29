import Image from 'next/image'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { SearchBox } from '@/components/dash/search-box'
import { EmptyState, Money, PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cleanQuery } from '@/lib/utils'
import { ProductToggle } from './product-toggle'

export const metadata = { title: 'Products' }

export default async function ProductsPage({ searchParams }: PageProps<'/dashboard/products'>) {
  const { perms } = await requireStaff('manager')
  const sp = await searchParams
  const q = cleanQuery(typeof sp.q === 'string' ? sp.q : '')
  const cat = typeof sp.category === 'string' ? sp.category : ''
  const status = typeof sp.status === 'string' ? sp.status : ''
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('sort_order')

  let query = supabase
    .from('products')
    .select('id, name, slug, images, is_active, is_featured, price_min, price_max, total_stock, category_id, categories(name), product_variants(id, quantity_on_hand, low_stock_threshold, is_active)')
    .order('created_at', { ascending: false })
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  if (cat) query = query.eq('category_id', cat)
  if (status === 'hidden') query = query.eq('is_active', false)
  if (status === 'live') query = query.eq('is_active', true)
  const { data } = await query.limit(300)
  const products = (data ?? []).filter((p) => perms.owner || !perms.categories.length || perms.categories.includes(p.category_id))

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} product${products.length === 1 ? '' : 's'}${perms.categories.length ? ' in your categories' : ''}`}
        actions={<Link href="/dashboard/products/new" className="btn btn-primary"><Plus className="size-4" /> New product</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Search products" />
        <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1 text-xs font-bold">
          <Link href={`?${new URLSearchParams({ ...(q && { q }), ...(status && { status }) })}`} className={`rounded-full px-3 py-1.5 ${!cat ? 'bg-ink text-white' : 'text-muted'}`}>All</Link>
          {(categories ?? []).map((c) => (
            <Link key={c.id} href={`?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), category: c.id })}`} className={`rounded-full px-3 py-1.5 ${cat === c.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{c.name}</Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-white p-1 text-xs font-bold">
          {[['', 'Any status'], ['live', 'Live'], ['hidden', 'Hidden']].map(([k, l]) => (
            <Link key={k} href={`?${new URLSearchParams({ ...(q && { q }), ...(cat && { category: cat }), ...(k && { status: k }) })}`} className={`rounded-full px-3 py-1.5 ${status === k ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {products.length === 0 ? (
          <EmptyState Icon={Package} title="No products yet" body="Add your first product — sizes, colours, prices and barcodes are set up in one go." action={<Link href="/dashboard/products/new" className="btn btn-primary">Add a product</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Product</th><th>Category</th><th>Variants</th><th>Stock</th><th>Price</th><th>Live</th></tr></thead>
              <tbody>
                {products.map((p) => {
                  const active = p.product_variants.filter((v) => v.is_active)
                  const low = active.filter((v) => v.quantity_on_hand <= v.low_stock_threshold).length
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-3">
                          <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-sand">{p.images[0] && <Image src={p.images[0]} alt="" fill sizes="44px" className="object-cover" />}</div>
                          <div className="min-w-0">
                            <p className="max-w-64 truncate font-bold hover:text-clay">{p.name}</p>
                            {p.is_featured && <span className="text-[0.65rem] font-bold text-gold uppercase">Featured</span>}
                          </div>
                        </Link>
                      </td>
                      <td>{p.categories?.name}</td>
                      <td>{active.length}</td>
                      <td>
                        <span className={p.total_stock === 0 ? 'font-bold text-danger' : 'font-semibold'}>{p.total_stock}</span>
                        {low > 0 && <span className="ml-2 chip bg-warning-soft text-warning">{low} low</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        <Money value={p.price_min} />{p.price_max && p.price_max !== p.price_min ? <> – <Money value={p.price_max} /></> : null}
                      </td>
                      <td><ProductToggle id={p.id} active={p.is_active} /></td>
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
