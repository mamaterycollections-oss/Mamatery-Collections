import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/shop/product-card'
import { Filters } from '@/components/shop/filters'
import { cleanQuery } from '@/lib/utils'
import { getCategories, getOptions, PRODUCT_CARD_FIELDS } from '@/lib/store'
import { createPublicClient } from '@/lib/supabase/public'

const PAGE_SIZE = 24
export type CatalogParams = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const list = (v: string | string[] | undefined) => one(v).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20)

export async function Catalog({ categorySlug, params }: { categorySlug?: string; params: CatalogParams }) {
  const [categories, options] = await Promise.all([getCategories(), getOptions()])
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null
  if (categorySlug && !category) notFound()

  const q = cleanQuery(one(params.q))
  const sort = one(params.sort) || 'featured'
  const sizes = list(params.size)
  const colours = list(params.colour)
  const min = Number(one(params.min)) || null
  const max = Number(one(params.max)) || null
  const inStock = one(params.instock) === '1'
  const sale = one(params.sale) === '1'
  const page = Math.max(1, Number(one(params.page)) || 1)

  let query = createPublicClient().from('products').select(PRODUCT_CARD_FIELDS, { count: 'exact' }).eq('is_active', true)
  if (category) query = query.in('category_id', [category.id, ...categories.filter((c) => c.parent_id === category.id).map((c) => c.id)])
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  if (sizes.length) query = query.overlaps('sizes', sizes)
  if (colours.length) query = query.overlaps('colours', colours)
  if (min) query = query.gte('price_min', min)
  if (max) query = query.lte('price_min', max)
  if (inStock) query = query.gt('total_stock', 0)
  if (sale) query = query.not('compare_at_price', 'is', null)
  query =
    sort === 'new' ? query.order('created_at', { ascending: false })
    : sort === 'price-asc' ? query.order('price_min', { ascending: true, nullsFirst: false })
    : sort === 'price-desc' ? query.order('price_min', { ascending: false, nullsFirst: false })
    : sort === 'rating' ? query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false })
    : query.order('is_featured', { ascending: false }).order('total_stock', { ascending: false }).order('created_at', { ascending: false })
  const { data, count } = await query.range(0, page * PAGE_SIZE - 1)
  const products = data ?? []
  const total = count ?? 0
  const colourHex = Object.fromEntries(options.colours.map((c) => [c.value, c.hex]))
  const title = q ? `Results for “${q}”` : sale ? 'On sale' : category?.name ?? (sort === 'new' ? 'New arrivals' : 'Shop all')
  const nextParams = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v ? [[k, one(v)]] : [])))
  nextParams.set('page', String(page + 1))

  return (
    <div className="container-page pt-8 sm:pt-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> <span className="mx-1.5">/</span>
        {category ? (
          <>
            <Link href="/shop" className="hover:text-ink">Shop</Link> <span className="mx-1.5">/</span>
            <span className="text-ink">{category.name}</span>
          </>
        ) : (
          <span className="text-ink">Shop</span>
        )}
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-6xl">{title}</h1>
          {category?.description && !q && <p className="mt-3 max-w-xl text-muted">{category.description}</p>}
        </div>
        <p className="text-sm text-muted">{total} {total === 1 ? 'piece' : 'pieces'}</p>
      </div>

      {/* Category chips */}
      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        <Link href="/shop" className={`chip border px-4 py-2 text-xs ${!category ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>All</Link>
        {categories.filter((c) => !c.parent_id || c.parent_id === category?.id || c.id === category?.parent_id).map((c) => (
          <Link key={c.id} href={`/shop/${c.slug}`} className={`chip border px-4 py-2 text-xs ${category?.id === c.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <Filters sizes={options.sizes.map((s) => s.value)} colours={options.colours.map((c) => ({ value: c.value, hex: c.hex }))} total={total} />
        <div>
          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone p-12 text-center">
              <p className="font-display text-2xl">Nothing matches — yet</p>
              <p className="mt-2 text-sm text-muted">Try removing a filter or searching for something else.</p>
              <Link href={category ? `/shop/${category.slug}` : '/shop'} className="btn btn-primary mt-6">Clear filters</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} colourHex={colourHex} priority={i < 4} />
              ))}
            </div>
          )}
          {products.length < total && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="text-xs text-muted">Showing {products.length} of {total}</p>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-stone">
                <div className="h-full bg-ink" style={{ width: `${(products.length / total) * 100}%` }} />
              </div>
              <Link href={`?${nextParams}`} scroll={false} className="btn btn-outline mt-2">Load more</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
