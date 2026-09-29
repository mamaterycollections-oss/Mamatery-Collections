'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatKes } from '@/lib/utils'

type Item = { id: string; name: string; slug: string; image: string | null; price: number }
const KEY = 'mt-recent-v1'

export function RecentlyViewed({ current }: { current: Item }) {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    let list: Item[] = []
    try {
      list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    } catch {}
    setItems(list.filter((i) => i.id !== current.id).slice(0, 6))
    localStorage.setItem(KEY, JSON.stringify([current, ...list.filter((i) => i.id !== current.id)].slice(0, 12)))
  }, [current])

  if (!items.length) return null
  return (
    <section className="container-page pt-20">
      <h2 className="font-display text-2xl sm:text-3xl">Recently viewed</h2>
      <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:px-0">
        {items.map((i) => (
          <Link key={i.id} href={`/product/${i.slug}`} className="group w-32 shrink-0 sm:w-40">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
              {i.image && <Image src={i.image} alt={i.name} fill sizes="160px" className="object-cover transition duration-500 group-hover:scale-105" />}
            </div>
            <p className="mt-2 truncate text-xs font-semibold">{i.name}</p>
            <p className="text-xs text-muted">{formatKes(i.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
