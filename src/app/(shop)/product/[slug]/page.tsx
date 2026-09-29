import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { ProductCard } from '@/components/shop/product-card'
import { ProductView } from '@/components/shop/product-view'
import { RecentlyViewed } from '@/components/shop/recently-viewed'
import { Reviews } from '@/components/shop/reviews'
import { SectionHeading } from '@/components/ui/reveal'
import { siteUrl } from '@/lib/site-url'
import { getOptions, getSettings, PRODUCT_CARD_FIELDS } from '@/lib/store'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60
export const generateStaticParams = async () => []

const getProduct = async (slug: string) => {
  const { data } = await createPublicClient()
    .from('products')
    .select('*, categories(id, name, slug), product_variants(id, size, colour, sku, selling_price, quantity_on_hand, low_stock_threshold, image_url, is_active)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const p = await getProduct(slug)
  if (!p) return {}
  const description = p.description?.slice(0, 160) ?? `Shop ${p.name} at MamaTerryCollections.`
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, images: p.images.slice(0, 1) },
  }
}

export default async function ProductPage({ params }: PageProps<'/product/[slug]'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const supabase = createPublicClient()
  const [options, settings, related, reviews] = await Promise.all([
    getOptions(),
    getSettings(),
    supabase.from('products').select(PRODUCT_CARD_FIELDS).eq('is_active', true).eq('category_id', product.category_id).neq('id', product.id).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    supabase.from('reviews').select('id, rating, title, comment, author_name, verified_purchase, created_at').eq('product_id', product.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(30),
  ])

  const sizeOrder = new Map(options.sizes.map((s, i) => [s.value, i]))
  const variants = product.product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => (sizeOrder.get(a.size ?? '') ?? 99) - (sizeOrder.get(b.size ?? '') ?? 99))
  const colourHex = Object.fromEntries(options.colours.map((c) => [c.value, c.hex]))
  const relatedList = related.data ?? []

  const price = product.price_min ?? product.base_price
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'MamaTerryCollections' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'KES',
      lowPrice: price,
      highPrice: product.price_max ?? price,
      availability: product.total_stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${siteUrl()}/product/${product.slug}`,
    },
    ...(product.rating_count > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating_avg, reviewCount: product.rating_count } }),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="container-page pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="truncate text-xs text-muted">
          <Link href="/" className="hover:text-ink">Home</Link> <span className="mx-1.5">/</span>
          {product.categories && (
            <>
              <Link href={`/shop/${product.categories.slug}`} className="hover:text-ink">{product.categories.name}</Link> <span className="mx-1.5">/</span>
            </>
          )}
          <span className="text-ink">{product.name}</span>
        </nav>
        <ProductView
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            images: product.images,
            compare_at_price: product.compare_at_price != null ? Number(product.compare_at_price) : null,
            base_price: Number(product.base_price),
            rating_avg: Number(product.rating_avg),
            rating_count: product.rating_count,
            category: product.categories?.name ?? null,
          }}
          variants={variants.map((v) => ({ ...v, selling_price: Number(v.selling_price) }))}
          colourHex={colourHex}
          delivery={{
            returnDays: settings.return_window_days,
            pickup: settings.pickup_enabled ? settings.pickup_address : null,
            freeOver: settings.free_delivery_threshold != null ? Number(settings.free_delivery_threshold) : null,
            whatsapp: settings.whatsapp ?? settings.phone,
          }}
        />
      </div>

      <div className="container-page pt-20">
        <Reviews productId={product.id} productSlug={product.slug} reviews={reviews.data ?? []} average={Number(product.rating_avg)} count={product.rating_count} />
      </div>

      {relatedList.length > 0 && (
        <section className="container-page pt-20">
          <SectionHeading
            eyebrow="Browse more"
            title="You may also like"
            action={product.categories && <Link href={`/shop/${product.categories.slug}`} className="btn btn-light btn-sm shrink-0">More {product.categories.name.toLowerCase()} <ArrowRight className="size-4" /></Link>}
          />
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {relatedList.slice(0, 4).map((p, i) => (
              <div key={p.id} className="w-[62%] shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} index={i} colourHex={colourHex} />
              </div>
            ))}
          </div>
        </section>
      )}
      <RecentlyViewed current={{ id: product.id, name: product.name, slug: product.slug, image: product.images[0] ?? null, price: Number(price) }} />
    </>
  )
}
