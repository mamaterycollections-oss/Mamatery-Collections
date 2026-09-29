'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { ProductCard, ProductCardSkeleton } from '@/components/shop/product-card'
import { useWishlist } from '@/components/wishlist-provider'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_CARD_FIELDS, type ProductCard as Card } from '@/lib/store'

export default function WishlistPage() {
  const { ids } = useWishlist()
  const [items, setItems] = useState<Card[] | null>(null)
  const [hex, setHex] = useState<Record<string, string | null>>({})
  const key = [...ids].sort().join(',')

  useEffect(() => {
    const list = key ? key.split(',') : []
    const supabase = createClient()
    supabase.from('attribute_options').select('value, hex').eq('kind', 'colour').then(({ data }) => setHex(Object.fromEntries((data ?? []).map((c) => [c.value, c.hex]))))
    if (!list.length) return setItems([])
    supabase.from('products').select(PRODUCT_CARD_FIELDS).in('id', list).eq('is_active', true).then(({ data }) => setItems((data as Card[]) ?? []))
  }, [key])

  return (
    <div className="container-page pt-8 sm:pt-12">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Your wishlist</h1>
      <div className="mt-8">
        {items === null ? (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone p-12 text-center">
            <Heart className="mx-auto size-8 text-muted" />
            <p className="mt-3 font-display text-2xl">Nothing saved yet</p>
            <p className="mt-2 text-sm text-muted">Tap the heart on anything you love to keep it here.</p>
            <Link href="/shop" className="btn btn-primary mt-6">Browse the shop</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p, i) => <ProductCard key={p.id} product={p} index={i} colourHex={hex} />)}
          </div>
        )}
      </div>
    </div>
  )
}
