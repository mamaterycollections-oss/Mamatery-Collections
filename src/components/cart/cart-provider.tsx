'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'

export type CartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  variantLabel: string
  image: string | null
  price: number
  quantity: number
  maxQty: number
}

type CartCtx = {
  lines: CartLine[]
  count: number
  subtotal: number
  open: boolean
  setOpen: (open: boolean) => void
  lastAdded: (CartLine & { nonce: number }) | null
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
  replace: (lines: CartLine[]) => void
}

const CartContext = createContext<CartCtx | null>(null)
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart outside CartProvider')
  return ctx
}

const KEY = 'mt-cart-v1'
const read = (): CartLine[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.variantId === 'string' && l.quantity > 0) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<(CartLine & { nonce: number }) | null>(null)
  const addCount = useRef(0)
  const hydrated = useRef(false)
  const syncedUser = useRef<string | null>(null)

  useEffect(() => {
    setLines(read())
    hydrated.current = true
    // Keep tabs in sync
    const onStorage = (e: StorageEvent) => e.key === KEY && setLines(read())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (hydrated.current) localStorage.setItem(KEY, JSON.stringify(lines))
  }, [lines])

  // On sign-in: merge the device bag with the account bag (so it follows the customer across devices).
  useEffect(() => {
    if (!userId || syncedUser.current === userId) return
    syncedUser.current = userId
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('cart_items')
        .select('variant_id, quantity, product_variants(id, size, colour, selling_price, quantity_on_hand, image_url, is_active, products(id, slug, name, images, is_active))')
        .eq('user_id', userId)
      const remote: CartLine[] = (data ?? []).flatMap((row) => {
        const v = row.product_variants
        const p = v?.products
        if (!v || !p || !v.is_active || !p.is_active) return []
        return [{
          variantId: v.id,
          productId: p.id,
          slug: p.slug,
          name: p.name,
          variantLabel: [v.size, v.colour].filter(Boolean).join(' / '),
          image: v.image_url ?? p.images[0] ?? null,
          price: Number(v.selling_price),
          quantity: Math.min(row.quantity, v.quantity_on_hand),
          maxQty: v.quantity_on_hand,
        }].filter((l) => l.quantity > 0)
      })
      setLines((local) => {
        const merged = new Map<string, CartLine>()
        for (const l of [...remote, ...local]) {
          const prev = merged.get(l.variantId)
          merged.set(l.variantId, prev ? { ...l, quantity: Math.min(Math.max(prev.quantity, l.quantity), l.maxQty || 99) } : l)
        }
        const result = [...merged.values()]
        if (result.length) {
          supabase
            .from('cart_items')
            .upsert(result.map((l) => ({ user_id: userId, variant_id: l.variantId, quantity: l.quantity })))
            .then(() => undefined)
        }
        return result
      })
    })()
  }, [userId])

  const pushRemote = useCallback(
    (variantId: string, quantity: number) => {
      if (!userId) return
      const supabase = createClient()
      const q = quantity > 0
        ? supabase.from('cart_items').upsert({ user_id: userId, variant_id: variantId, quantity })
        : supabase.from('cart_items').delete().eq('user_id', userId).eq('variant_id', variantId)
      q.then(() => undefined)
    },
    [userId],
  )

  const add = useCallback<CartCtx['add']>(
    (line, quantity = 1) => {
      let next = 0
      setLines((current) => {
        const existing = current.find((l) => l.variantId === line.variantId)
        const cap = Math.max(1, Math.min(line.maxQty, 99))
        if (existing) {
          next = Math.min(existing.quantity + quantity, cap)
          return current.map((l) => (l.variantId === line.variantId ? { ...l, ...line, quantity: next } : l))
        }
        next = Math.min(quantity, cap)
        return [...current, { ...line, quantity: next }]
      })
      setLastAdded({ ...line, quantity, nonce: ++addCount.current })
      setOpen(true)
      queueMicrotask(() => pushRemote(line.variantId, next))
    },
    [pushRemote],
  )

  const setQuantity = useCallback(
    (variantId: string, quantity: number) => {
      setLines((current) =>
        current.flatMap((l) => (l.variantId !== variantId ? [l] : quantity <= 0 ? [] : [{ ...l, quantity: Math.min(quantity, l.maxQty || 99) }])),
      )
      pushRemote(variantId, quantity)
    },
    [pushRemote],
  )

  const remove = useCallback((variantId: string) => setQuantity(variantId, 0), [setQuantity])

  const clear = useCallback(() => {
    setLines([])
    if (userId) createClient().from('cart_items').delete().eq('user_id', userId).then(() => undefined)
  }, [userId])

  const value = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
      open,
      setOpen,
      lastAdded,
      add,
      setQuantity,
      remove,
      clear,
      replace: setLines,
    }),
    [lines, open, lastAdded, add, setQuantity, remove, clear],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
