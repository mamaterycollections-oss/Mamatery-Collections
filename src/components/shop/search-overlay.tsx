'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cleanQuery, formatKes } from '@/lib/utils'

type Hit = { id: string; name: string; slug: string; images: string[]; price_min: number | null; base_price: number }


export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTimeout(() => input.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    const term = cleanQuery(q)
    if (term.length < 2) {
      setHits([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from('products')
        .select('id, name, slug, images, price_min, base_price')
        .eq('is_active', true)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%,tags.cs.{${term.toLowerCase().split(' ')[0]}}`)
        .order('total_stock', { ascending: false })
        .limit(6)
      setHits(data ?? [])
      setLoading(false)
    }, 220)
    return () => clearTimeout(t)
  }, [q])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const term = cleanQuery(q)
    if (!term) return
    onClose()
    router.push(`/shop?q=${encodeURIComponent(term)}`)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} aria-label="Close search" />
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="relative bg-paper shadow-lift"
            role="dialog"
            aria-label="Search products"
          >
            <form onSubmit={submit} className="container-page flex items-center gap-3 py-4 sm:py-6">
              <Search className="size-5 shrink-0 text-muted" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search dresses, bags, caps…"
                className="min-w-0 flex-1 bg-transparent font-display text-2xl outline-none placeholder:text-stone sm:text-3xl"
                enterKeyHint="search"
                aria-label="Search"
              />
              {loading && <Loader2 className="size-5 animate-spin text-muted" />}
              <button type="button" onClick={onClose} className="btn-icon btn-ghost" aria-label="Close">
                <X className="size-5" />
              </button>
            </form>
            {(hits.length > 0 || cleanQuery(q).length >= 2) && (
              <div className="container-page max-h-[65vh] overflow-y-auto pb-6">
                {hits.length === 0 && !loading ? (
                  <p className="py-6 text-sm text-muted">No matches for “{q}”. Try another word or browse the shop.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {hits.map((h, i) => (
                      <motion.li key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}>
                        <Link href={`/product/${h.slug}`} onClick={onClose} className="flex items-center gap-4 rounded-2xl p-2 transition hover:bg-sand">
                          <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-sand">
                            {h.images[0] && <Image src={h.images[0]} alt="" fill sizes="52px" className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{h.name}</p>
                            <p className="text-sm text-muted">{formatKes(h.price_min ?? h.base_price)}</p>
                          </div>
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
                {hits.length > 0 && (
                  <button onClick={submit} className="btn btn-light btn-sm mt-4">
                    See all results <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
