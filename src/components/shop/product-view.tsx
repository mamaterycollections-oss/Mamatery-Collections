'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Minus, Plus, Ruler, Share2, ShoppingBag, Star, Store, Truck, RotateCcw, X, MessageCircle } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { useWishlist } from '@/components/wishlist-provider'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { whatsappLink } from '@/lib/store'
import { cn, formatKes, STOCK_LABEL, stockState, variantLabel } from '@/lib/utils'

type Variant = {
  id: string
  size: string | null
  colour: string | null
  sku: string
  selling_price: number
  quantity_on_hand: number
  low_stock_threshold: number
  image_url: string | null
}
type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  images: string[]
  compare_at_price: number | null
  base_price: number
  rating_avg: number
  rating_count: number
  category: string | null
}

export function ProductView({
  product,
  variants: initial,
  colourHex,
  delivery,
}: {
  product: Product
  variants: Variant[]
  colourHex: Record<string, string | null>
  delivery: { returnDays: number; pickup: string | null; freeOver: number | null; whatsapp: string | null }
}) {
  const cart = useCart()
  const wishlist = useWishlist()
  const toast = useToast()
  const [variants, setVariants] = useState(initial)
  const colours = useMemo(() => [...new Set(variants.map((v) => v.colour).filter(Boolean))] as string[], [variants])
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants])
  const firstInStock = variants.find((v) => v.quantity_on_hand > 0) ?? variants[0]
  const [colour, setColour] = useState<string | null>(firstInStock?.colour ?? null)
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null)
  const [qty, setQty] = useState(1)
  const [sizeError, setSizeError] = useState(false)
  const [guide, setGuide] = useState(false)
  const [flying, setFlying] = useState<{ src: string; from: DOMRect; to: DOMRect } | null>(null)
  const imageBox = useRef<HTMLDivElement>(null)

  // Live stock: reflect sales and restocks while the page is open.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`stock-${product.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'product_variants', filter: `product_id=eq.${product.id}` }, (payload) => {
        const row = payload.new as Variant
        setVariants((vs) => vs.map((v) => (v.id === row.id ? { ...v, quantity_on_hand: row.quantity_on_hand, selling_price: Number(row.selling_price) } : v)))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [product.id])

  const selected = variants.find((v) => (v.colour ?? null) === (colour ?? null) && (sizes.length === 0 || v.size === size)) ?? null
  const priceShown = selected?.selling_price ?? Math.min(...variants.map((v) => v.selling_price), product.base_price || Infinity)
  const onSale = product.compare_at_price != null && product.compare_at_price > priceShown
  const state = selected ? stockState(selected.quantity_on_hand, selected.low_stock_threshold) : null
  const colourStock = (c: string | null) => variants.filter((v) => v.colour === c).reduce((s, v) => s + v.quantity_on_hand, 0)
  const sizeVariant = (s: string) => variants.find((v) => v.size === s && (v.colour ?? null) === (colour ?? null))

  // Gallery: the selected colour's image first, then the rest.
  const gallery = useMemo(() => {
    const colourImg = variants.find((v) => v.colour === colour && v.image_url)?.image_url
    const list = colourImg ? [colourImg, ...product.images.filter((i) => i !== colourImg)] : product.images
    return list.length ? list : []
  }, [colour, variants, product.images])
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  useEffect(() => setActive(0), [colour])
  useEffect(() => setQty(1), [selected?.id])

  const addToBag = () => {
    if (!selected) {
      setSizeError(true)
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (selected.quantity_on_hand <= 0) return
    const line = {
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(selected.size, selected.colour),
      image: selected.image_url ?? product.images[0] ?? null,
      price: selected.selling_price,
      maxQty: selected.quantity_on_hand,
    }
    const target = document.querySelector('[aria-label^="Bag ("]:not([class*="hidden"])') as HTMLElement | null
    const from = imageBox.current?.getBoundingClientRect()
    const to = [...document.querySelectorAll<HTMLElement>('[aria-label^="Bag ("]')].find((el) => el.offsetParent !== null)?.getBoundingClientRect() ?? target?.getBoundingClientRect()
    if (from && to && gallery[active] && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlying({ src: gallery[active], from, to })
      setTimeout(() => {
        setFlying(null)
        cart.add(line, qty)
      }, 650)
    } else {
      cart.add(line, qty)
    }
  }

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: product.name, url }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    }
  }

  const saved = wishlist.has(product.id)
  const wa = whatsappLink(delivery.whatsapp, `Hi! I'm interested in ${product.name}${selected ? ` (${variantLabel(selected.size, selected.colour)})` : ''}: ${typeof window !== 'undefined' ? window.location.href : ''}`)

  return (
    <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
      {/* Gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar sm:max-h-[40rem] sm:flex-col sm:overflow-y-auto">
              {gallery.map((src, i) => (
                <button key={src} onClick={() => setActive(i)} className={cn('relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-sand transition sm:w-20', i === active ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'opacity-70 hover:opacity-100')} aria-label={`Image ${i + 1}`}>
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <div ref={imageBox} className="relative flex-1">
            <ZoomImage src={gallery[active]} alt={product.name} onOpen={() => setLightbox(true)} onSwipe={(d) => setActive((a) => (a + d + gallery.length) % gallery.length)} />
            {gallery.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 sm:hidden">
                {gallery.map((_, i) => (
                  <span key={i} className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-5 bg-ink' : 'w-1.5 bg-ink/30')} />
                ))}
              </div>
            )}
            {onSale && <span className="chip absolute top-4 left-4 bg-clay text-white">Sale</span>}
          </div>
        </div>
      </div>

      {/* Details */}
      <div>
        {product.category && <p className="eyebrow">{product.category}</p>}
        <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">{product.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-baseline gap-3">
            <motion.span key={priceShown} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('text-2xl font-bold tabular-nums', onSale && 'text-clay')}>
              {formatKes(priceShown)}
            </motion.span>
            {onSale && <span className="text-muted tabular-nums line-through">{formatKes(product.compare_at_price)}</span>}
          </p>
          {product.rating_count > 0 && (
            <a href="#reviews" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
              <Star className="size-4 fill-gold text-gold" /> {product.rating_avg.toFixed(1)} · {product.rating_count} review{product.rating_count === 1 ? '' : 's'}
            </a>
          )}
        </div>

        {colours.length > 0 && (
          <div className="mt-8">
            <p className="text-sm">
              <span className="font-bold">Colour:</span> <span className="text-muted">{colour}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {colours.map((c) => {
                const out = colourStock(c) <= 0
                return (
                  <button
                    key={c}
                    onClick={() => setColour(c)}
                    title={`${c}${out ? ' (sold out)' : ''}`}
                    aria-label={`${c}${out ? ', sold out' : ''}`}
                    aria-pressed={colour === c}
                    className={cn('relative grid size-11 place-items-center rounded-full transition', colour === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'hover:scale-105')}
                  >
                    <span className="size-9 rounded-full border border-black/10" style={{ background: colourHex[c] ?? 'conic-gradient(#b4532a,#c49a4a,#2b56a8,#2d6a45,#b4532a)' }} />
                    {out && <span className="absolute h-px w-10 rotate-45 bg-ink/60" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-7" id="size-picker">
            <div className="flex items-center justify-between">
              <p className={cn('text-sm', sizeError && !size && 'text-danger')}>
                <span className="font-bold">Size:</span> <span className={cn(sizeError && !size ? 'text-danger' : 'text-muted')}>{size ?? 'Choose your size'}</span>
              </p>
              {!(sizes.length === 1 && sizes[0] === 'One Size') && (
                <button onClick={() => setGuide(true)} className="flex items-center gap-1 text-xs font-bold underline underline-offset-4">
                  <Ruler className="size-3.5" /> Size guide
                </button>
              )}
            </div>
            <motion.div className="mt-3 flex flex-wrap gap-2" animate={sizeError && !size ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.4 }}>
              {sizes.map((s) => {
                const v = sizeVariant(s)
                const out = !v || v.quantity_on_hand <= 0
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSize(s)
                      setSizeError(false)
                    }}
                    aria-pressed={size === s}
                    className={cn(
                      'relative min-w-14 rounded-xl border px-4 py-3 text-sm font-bold transition',
                      size === s ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink',
                      out && 'text-muted line-through decoration-1',
                    )}
                  >
                    {s}
                    {v && v.quantity_on_hand > 0 && v.quantity_on_hand <= v.low_stock_threshold && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning ring-2 ring-paper" />}
                  </button>
                )
              })}
            </motion.div>
          </div>
        )}

        <div className="mt-6 min-h-6">
          <AnimatePresence mode="wait">
            {state && (
              <motion.p key={`${selected?.id}-${state}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('flex items-center gap-2 text-sm font-semibold', state === 'in' ? 'text-success' : state === 'low' ? 'text-warning' : 'text-danger')}>
                <span className={cn('size-2 rounded-full', state === 'in' ? 'bg-success' : state === 'low' ? 'animate-pulse bg-warning' : 'bg-danger')} />
                {state === 'low' ? `Low stock — only ${selected!.quantity_on_hand} left` : STOCK_LABEL[state]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex items-center rounded-full border border-line bg-white">
            <button className="grid size-12 place-items-center disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
            <button className="grid size-12 place-items-center disabled:opacity-30" onClick={() => setQty((q) => q + 1)} disabled={!selected || qty >= selected.quantity_on_hand} aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={addToBag} disabled={state === 'out'} className="btn btn-primary btn-lg flex-1">
            <ShoppingBag className="size-4" /> {state === 'out' ? 'Sold out' : 'Add to bag'}
          </motion.button>
          <button
            onClick={() => toast.success(wishlist.toggle(product.id) ? 'Saved to your wishlist' : 'Removed from wishlist')}
            className="grid size-[3.2rem] shrink-0 place-items-center rounded-full border border-line bg-white transition hover:border-ink"
            aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={saved}
          >
            <Heart className={cn('size-5', saved && 'fill-clay text-clay')} />
          </button>
        </div>
        {state === 'out' && wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-light mt-3 w-full">
            <MessageCircle className="size-4" /> Ask us when it&apos;s back
          </a>
        )}

        <ul className="mt-8 grid gap-3 rounded-2xl bg-sand p-5 text-sm sm:grid-cols-2">
          <li className="flex gap-3"><Truck className="size-5 shrink-0 text-clay" /> <span>Delivery across Kenya{delivery.freeOver ? ` · free over ${formatKes(delivery.freeOver)}` : ''}</span></li>
          <li className="flex gap-3"><Check className="size-5 shrink-0 text-clay" /> <span>Pay securely with M-Pesa</span></li>
          <li className="flex gap-3"><RotateCcw className="size-5 shrink-0 text-clay" /> <span>Returns within {delivery.returnDays} days</span></li>
          {delivery.pickup && <li className="flex gap-3"><Store className="size-5 shrink-0 text-clay" /> <span>Free pickup: {delivery.pickup}</span></li>}
        </ul>

        <div className="mt-8 divide-y divide-line border-y border-line">
          <Accordion title="Details" defaultOpen>
            <p className="leading-relaxed whitespace-pre-line text-muted">{product.description ?? 'No description yet.'}</p>
            {selected && <p className="mt-3 text-xs text-muted">SKU: {selected.sku}</p>}
          </Accordion>
          <Accordion title="Delivery & returns">
            <p className="leading-relaxed text-muted">
              Orders are confirmed as soon as payment is received and dispatched by courier or boda. You&apos;ll get SMS updates at every step.
              Unworn items with tags can be returned within {delivery.returnDays} days. <a href="/delivery-returns" className="font-semibold text-ink underline">Full policy</a>
            </p>
          </Accordion>
        </div>

        <div className="mt-6 flex items-center gap-4 text-sm">
          <button onClick={share} className="flex items-center gap-2 font-semibold hover:text-clay"><Share2 className="size-4" /> Share</button>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:text-clay"><MessageCircle className="size-4" /> Ask on WhatsApp</a>}
        </div>
      </div>

      {/* Sticky buy bar on phones (above the tab bar) */}
      <div className="fixed inset-x-0 bottom-[3.9rem] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{selected ? variantLabel(selected.size, selected.colour) : 'Choose options'}</p>
            <p className="font-bold tabular-nums">{formatKes(priceShown)}</p>
          </div>
          <button onClick={addToBag} disabled={state === 'out'} className="btn btn-primary">
            <ShoppingBag className="size-4" /> {state === 'out' ? 'Sold out' : 'Add to bag'}
          </button>
        </div>
      </div>

      {/* Fly-to-bag animation */}
      <AnimatePresence>
        {flying && (
          <motion.div
            className="pointer-events-none fixed z-[80] overflow-hidden rounded-2xl shadow-lift"
            initial={{ left: flying.from.left, top: flying.from.top, width: flying.from.width, height: flying.from.height, opacity: 1, borderRadius: 16 }}
            animate={{
              left: flying.to.left + flying.to.width / 2 - 14,
              top: flying.to.top + flying.to.height / 2 - 14,
              width: 28,
              height: 28,
              opacity: 0.6,
              borderRadius: 999,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.62, ease: [0.6, 0, 0.3, 1] }}
          >
            <Image src={flying.src} alt="" fill sizes="400px" className="object-cover" />
          </motion.div>
        )}
      </AnimatePresence>

      <Lightbox open={lightbox} images={gallery} index={active} onIndex={setActive} onClose={() => setLightbox(false)} alt={product.name} />
      <SizeGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  )
}

function ZoomImage({ src, alt, onOpen, onSwipe }: { src?: string; alt: string; onOpen: () => void; onSwipe: (dir: number) => void }) {
  const [origin, setOrigin] = useState<string | null>(null)
  return (
    <motion.div
      className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl bg-sand"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
      }}
      onMouseLeave={() => setOrigin(null)}
      onClick={onOpen}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => Math.abs(info.offset.x) > 60 && onSwipe(info.offset.x < 0 ? 1 : -1)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {src && (
          <motion.div key={src} className="absolute inset-0" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <Image
              src={src}
              alt={alt}
              fill
              priority
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 ease-out"
              style={{ transform: origin ? 'scale(1.8)' : 'scale(1)', transformOrigin: origin ?? 'center' }}
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Lightbox({ open, images, index, onIndex, onClose, alt }: { open: boolean; images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void; alt: string }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, index, images.length, onClose, onIndex])

  return (
    <AnimatePresence>
      {open && images[index] && (
        <motion.div className="fixed inset-0 z-[90] bg-ink/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="Image viewer">
          <button onClick={onClose} className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
            <X className="size-5" />
          </button>
          <motion.div
            key={images[index]}
            className="absolute inset-0 m-auto aspect-[4/5] max-h-[90dvh] max-w-[92vw]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => Math.abs(info.offset.x) > 60 && onIndex((index + (info.offset.x < 0 ? 1 : -1) + images.length) % images.length)}
          >
            <Image src={images[index]} alt={alt} fill sizes="92vw" className="rounded-2xl object-contain" draggable={false} />
          </motion.div>
          {images.length > 1 && (
            <>
              <button onClick={() => onIndex((index - 1 + images.length) % images.length)} className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white" aria-label="Previous">
                <ChevronLeft className="size-5" />
              </button>
              <button onClick={() => onIndex((index + 1) % images.length)} className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white" aria-label="Next">
                <ChevronRight className="size-5" />
              </button>
              <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/70">{index + 1} / {images.length}</p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-4 text-left font-bold" aria-expanded={open}>
        {title} <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pb-5 text-sm">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const GUIDE = [
  ['XS', '6', '76–80', '60–64', '84–88'],
  ['S', '8', '81–85', '65–69', '89–93'],
  ['M', '10', '86–90', '70–74', '94–98'],
  ['L', '12', '91–96', '75–80', '99–104'],
  ['XL', '14', '97–102', '81–86', '105–110'],
  ['XXL', '16', '103–108', '87–92', '111–116'],
  ['3XL', '18', '109–114', '93–98', '117–122'],
]

function SizeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="Close size guide" />
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="relative w-full max-w-lg rounded-t-3xl bg-paper p-6 pb-safe sm:rounded-3xl" role="dialog" aria-label="Size guide">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Size guide</h2>
              <button onClick={onClose} className="btn-icon btn-ghost" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="mt-1 text-sm text-muted">Body measurements in centimetres. Between sizes? Size up for a relaxed fit.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="table">
                <thead><tr><th>Size</th><th>UK</th><th>Bust</th><th>Waist</th><th>Hips</th></tr></thead>
                <tbody>{GUIDE.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? 'font-bold' : ''}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
