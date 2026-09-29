'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'

type Ctx = { ids: Set<string>; has: (id: string) => boolean; toggle: (id: string) => boolean; count: number }
const WishlistContext = createContext<Ctx | null>(null)
export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist outside WishlistProvider')
  return ctx
}

const KEY = 'mt-wishlist-v1'

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const hydrated = useRef(false)
  const synced = useRef<string | null>(null)

  useEffect(() => {
    try {
      setIds(new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')))
    } catch {}
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (hydrated.current) localStorage.setItem(KEY, JSON.stringify([...ids]))
  }, [ids])

  useEffect(() => {
    if (!userId || synced.current === userId) return
    synced.current = userId
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.from('wishlist_items').select('product_id').eq('user_id', userId)
      setIds((local) => {
        const merged = new Set([...local, ...(data ?? []).map((r) => r.product_id)])
        const missing = [...merged].filter((id) => !(data ?? []).some((r) => r.product_id === id))
        if (missing.length) supabase.from('wishlist_items').upsert(missing.map((product_id) => ({ user_id: userId, product_id }))).then(() => undefined)
        return merged
      })
    })()
  }, [userId])

  const toggle = useCallback(
    (id: string) => {
      const adding = !ids.has(id)
      setIds((current) => {
        const next = new Set(current)
        if (adding) next.add(id)
        else next.delete(id)
        return next
      })
      if (userId) {
        const supabase = createClient()
        ;(adding
          ? supabase.from('wishlist_items').upsert({ user_id: userId, product_id: id })
          : supabase.from('wishlist_items').delete().eq('user_id', userId).eq('product_id', id)
        ).then(() => undefined)
      }
      return adding
    },
    [ids, userId],
  )

  const value = useMemo<Ctx>(() => ({ ids, has: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle])
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}
