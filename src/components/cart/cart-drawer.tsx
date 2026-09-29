'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Minus, Plus, ShoppingBag, Truck, X } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { formatKes } from '@/lib/utils'

export function CartDrawer({ freeDeliveryThreshold }: { freeDeliveryThreshold: number | null }) {
  const { lines, open, setOpen, subtotal, count, setQuantity, remove, lastAdded } = useCart()

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  const remaining = freeDeliveryThreshold ? Math.max(0, freeDeliveryThreshold - subtotal) : null
  const progress = freeDeliveryThreshold ? Math.min(100, (subtotal / freeDeliveryThreshold) * 100) : 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Close bag" />
          <motion.aside
            role="dialog"
            aria-label="Shopping bag"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-2xl">
                Your bag <span className="text-base text-muted">({count})</span>
              </h2>
              <button className="btn-icon btn-ghost" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <AnimatePresence>
              {lastAdded && (
                <motion.div
                  key={lastAdded.variantId + String(Date.now())}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-success-soft"
                >
                  <p className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-success">
                    <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className="grid size-5 place-items-center rounded-full bg-success text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                    Added {lastAdded.name}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {freeDeliveryThreshold != null && lines.length > 0 && (
              <div className="border-b border-line px-5 py-3">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Truck className="size-4 text-clay" />
                  {remaining! > 0 ? <>You&apos;re {formatKes(remaining)} away from free delivery</> : <>You&apos;ve unlocked free delivery 🎉</>}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone">
                  <motion.div className="h-full rounded-full bg-clay" initial={false} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                </div>
              </div>
            )}

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <div className="grid size-20 place-items-center rounded-full bg-sand">
                  <ShoppingBag className="size-8 text-muted" />
                </div>
                <p className="font-display text-2xl">Your bag is empty</p>
                <p className="text-sm text-muted">Find something you love — new pieces land every week.</p>
                <Link href="/shop" onClick={() => setOpen(false)} className="btn btn-primary mt-2">
                  Start shopping
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <motion.li key={l.variantId} layout exit={{ opacity: 0, x: 40, height: 0 }} className="flex gap-4 py-4">
                        <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="relative h-28 w-22 shrink-0 overflow-hidden rounded-xl bg-sand">
                          {l.image && <Image src={l.image} alt={l.name} fill sizes="88px" className="object-cover" />}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 text-sm font-bold">
                                {l.name}
                              </Link>
                              {l.variantLabel && <p className="mt-0.5 text-xs text-muted">{l.variantLabel}</p>}
                            </div>
                            <button onClick={() => remove(l.variantId)} className="text-muted hover:text-danger" aria-label={`Remove ${l.name}`}>
                              <X className="size-4" />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-2">
                            <div className="flex items-center rounded-full border border-line bg-white">
                              <button className="grid size-8 place-items-center" onClick={() => setQuantity(l.variantId, l.quantity - 1)} aria-label="Decrease quantity">
                                <Minus className="size-3.5" />
                              </button>
                              <span className="w-7 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                              <button
                                className="grid size-8 place-items-center disabled:opacity-30"
                                onClick={() => setQuantity(l.variantId, l.quantity + 1)}
                                disabled={l.quantity >= l.maxQty}
                                aria-label="Increase quantity"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                            <p className="text-sm font-bold tabular-nums">{formatKes(l.price * l.quantity)}</p>
                          </div>
                          {l.quantity >= l.maxQty && <p className="mt-1 text-[0.7rem] font-semibold text-warning">Only {l.maxQty} available</p>}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="border-t border-line bg-white px-5 pt-4 pb-safe">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Subtotal</span>
                    <span className="font-display text-2xl tabular-nums">{formatKes(subtotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Delivery and discounts are calculated at checkout.</p>
                  <Link href="/checkout" onClick={() => setOpen(false)} className="btn btn-primary btn-lg mt-4 w-full">
                    Checkout securely
                  </Link>
                  <button onClick={() => setOpen(false)} className="btn btn-ghost mt-1 mb-3 w-full">
                    Continue shopping
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
