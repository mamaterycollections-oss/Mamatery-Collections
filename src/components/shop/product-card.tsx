'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Heart, Star } from 'lucide-react'
import { useWishlist } from '@/components/wishlist-provider'
import { useToast } from '@/components/ui/toast'
import type { ProductCard as Card } from '@/lib/store'
import { cn, formatKes } from '@/lib/utils'

const NEW_DAYS = 14

export function ProductCard({ product, index = 0, colourHex = {}, priority = false }: { product: Card; index?: number; colourHex?: Record<string, string | null>; priority?: boolean }) {
  const wishlist = useWishlist()
  const toast = useToast()
  const saved = wishlist.has(product.id)
  const price = product.price_min ?? product.base_price
  const onSale = product.compare_at_price != null && Number(product.compare_at_price) > Number(price)
  const soldOut = product.total_stock <= 0
  const isNew = Date.now() - new Date(product.created_at).getTime() < NEW_DAYS * 86400000
  const lowStock = !soldOut && product.total_stock <= 3
  const [first, second] = product.images

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <Link href={`/product/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
          {first && (
            <Image
              src={first}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
              className={cn('object-cover transition duration-700 ease-out group-hover:scale-[1.04]', second && 'group-hover:opacity-0', soldOut && 'opacity-60 grayscale-[35%]')}
            />
          )}
          {second && (
            <Image
              src={second}
              alt=""
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
              className="scale-[1.04] object-cover opacity-0 transition duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
            />
          )}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {soldOut ? (
              <span className="chip bg-ink text-white">Sold out</span>
            ) : onSale ? (
              <span className="chip bg-clay text-white">-{Math.round((1 - Number(price) / Number(product.compare_at_price)) * 100)}%</span>
            ) : isNew ? (
              <span className="chip bg-white/90 text-ink backdrop-blur">New</span>
            ) : null}
            {lowStock && <span className="chip bg-warning-soft text-warning">Only {product.total_stock} left</span>}
          </div>
        </div>
      </Link>
      <button
        onClick={() => {
          const added = wishlist.toggle(product.id)
          toast.success(added ? 'Saved to your wishlist' : 'Removed from wishlist')
        }}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur transition hover:scale-110"
        aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
        aria-pressed={saved}
      >
        <motion.span key={String(saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
          <Heart className={cn('size-4', saved ? 'fill-clay text-clay' : 'text-ink')} />
        </motion.span>
      </button>

      <Link href={`/product/${product.slug}`} className="mt-3 block">
        <h3 className="line-clamp-1 text-sm font-semibold sm:text-[0.95rem]">{product.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('text-sm font-bold tabular-nums', onSale && 'text-clay')}>
            {product.price_max && product.price_min !== product.price_max ? `From ${formatKes(price)}` : formatKes(price)}
          </span>
          {onSale && <span className="text-xs text-muted tabular-nums line-through">{formatKes(product.compare_at_price)}</span>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {product.colours.slice(0, 5).map((c) => (
              <span
                key={c}
                title={c}
                className="size-3.5 rounded-full border border-black/10"
                style={{ background: colourHex[c] ?? 'conic-gradient(#b4532a,#c49a4a,#2b56a8,#2d6a45,#b4532a)' }}
              />
            ))}
            {product.colours.length > 5 && <span className="text-[0.65rem] text-muted">+{product.colours.length - 5}</span>}
          </div>
          {product.rating_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <Star className="size-3 fill-gold text-gold" /> {Number(product.rating_avg).toFixed(1)}
            </span>
          )}
        </div>
      </Link>
    </motion.article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5] rounded-2xl" />
      <div className="skeleton mt-3 h-4 w-3/4 rounded" />
      <div className="skeleton mt-2 h-4 w-1/3 rounded" />
    </div>
  )
}
