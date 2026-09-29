'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SORTS = [
  ['featured', 'Featured'],
  ['new', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Top rated'],
] as const

const PRICE_BANDS = [
  ['', '1000', 'Under KES 1,000'],
  ['1000', '2500', 'KES 1,000 – 2,500'],
  ['2500', '5000', 'KES 2,500 – 5,000'],
  ['5000', '', 'Over KES 5,000'],
] as const

export function Filters({ sizes, colours, total }: { sizes: string[]; colours: { value: string; hex: string | null }[]; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
  }, [sheet])

  const selected = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean)
  const update = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString())
    mut(p)
    p.delete('page')
    start(() => router.push(`${pathname}${p.size ? `?${p}` : ''}`, { scroll: false }))
  }
  const toggle = (key: string, value: string) =>
    update((p) => {
      const cur = new Set(selected(key))
      if (cur.has(value)) cur.delete(value)
      else cur.add(value)
      if (cur.size) p.set(key, [...cur].join(','))
      else p.delete(key)
    })
  const setFlag = (key: string, on: boolean) => update((p) => (on ? p.set(key, '1') : p.delete(key)))
  const activeCount = ['size', 'colour', 'min', 'max', 'instock', 'sale'].reduce((n, k) => n + (params.get(k) ? 1 : 0), 0)

  const panel = (
    <div className="space-y-8">
      <Group title="Sort by">
        <div className="space-y-1">
          {SORTS.map(([value, label]) => {
            const active = (params.get('sort') ?? 'featured') === value
            return (
              <button key={value} onClick={() => update((p) => (value === 'featured' ? p.delete('sort') : p.set('sort', value)))} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm', active ? 'font-bold' : 'text-muted hover:text-ink')}>
                {label} {active && <Check className="size-4" />}
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Size">
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const on = selected('size').includes(s)
            return (
              <button key={s} onClick={() => toggle('size', s)} aria-pressed={on} className={cn('min-w-11 rounded-xl border px-3 py-2 text-xs font-bold transition', on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink')}>
                {s}
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Colour">
        <div className="grid grid-cols-5 gap-2.5 lg:grid-cols-4">
          {colours.map((c) => {
            const on = selected('colour').includes(c.value)
            return (
              <button key={c.value} onClick={() => toggle('colour', c.value)} aria-pressed={on} title={c.value} className="group flex flex-col items-center gap-1">
                <span className={cn('grid size-8 place-items-center rounded-full border transition', on ? 'ring-2 ring-ink ring-offset-2' : 'border-black/10 group-hover:scale-110')} style={{ background: c.hex ?? 'conic-gradient(#b4532a,#c49a4a,#2b56a8,#2d6a45,#b4532a)' }}>
                  {on && <Check className={cn('size-3.5', c.hex && ['#F4F2EE', '#D9C4A3', '#E7A3B6'].includes(c.hex) ? 'text-ink' : 'text-white')} />}
                </span>
                <span className="text-[0.62rem] text-muted">{c.value}</span>
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Price">
        <div className="space-y-1">
          {PRICE_BANDS.map(([min, max, label]) => {
            const on = (params.get('min') ?? '') === min && (params.get('max') ?? '') === max
            return (
              <button key={label} onClick={() => update((p) => { if (on) { p.delete('min'); p.delete('max') } else { if (min) p.set('min', min); else p.delete('min'); if (max) p.set('max', max); else p.delete('max') } })} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm', on ? 'font-bold' : 'text-muted hover:text-ink')}>
                {label} {on && <Check className="size-4" />}
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Show">
        <label className="flex items-center gap-3 py-1 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={params.get('instock') === '1'} onChange={(e) => setFlag('instock', e.target.checked)} /> In stock only
        </label>
        <label className="flex items-center gap-3 py-1 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={params.get('sale') === '1'} onChange={(e) => setFlag('sale', e.target.checked)} /> On sale
        </label>
      </Group>
      {activeCount > 0 && (
        <button onClick={() => update((p) => ['size', 'colour', 'min', 'max', 'instock', 'sale'].forEach((k) => p.delete(k)))} className="text-sm font-bold underline underline-offset-4">
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          {pending && <Loader2 className="absolute -top-7 right-0 size-4 animate-spin text-muted" />}
          {panel}
        </div>
      </aside>

      <div className="sticky top-[4.25rem] z-30 -mx-4 -mb-2 flex items-center gap-2 bg-paper/90 px-4 py-2 backdrop-blur lg:hidden">
        <button onClick={() => setSheet(true)} className="btn btn-light btn-sm">
          <SlidersHorizontal className="size-4" /> Filter &amp; sort {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-clay text-[0.65rem] text-white">{activeCount}</span>}
        </button>
        {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-ink/40" onClick={() => setSheet(false)} aria-label="Close filters" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => info.offset.y > 120 && setSheet(false)}
              className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-paper"
            >
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-stone" />
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="font-display text-2xl">Filter &amp; sort</h2>
                <button className="btn-icon btn-ghost" onClick={() => setSheet(false)} aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-6">{panel}</div>
              <div className="border-t border-line p-4 pb-safe">
                <button onClick={() => setSheet(false)} className="btn btn-primary btn-lg w-full">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : `Show ${total} ${total === 1 ? 'piece' : 'pieces'}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-3 text-ink">{title}</p>
      {children}
    </div>
  )
}
