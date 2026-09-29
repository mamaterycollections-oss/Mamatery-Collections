'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Minus, Plus, Printer, Search } from 'lucide-react'
import { Barcode } from '@/components/dash/barcode'
import { cn, formatKes } from '@/lib/utils'

type Variant = { id: string; size: string | null; colour: string | null; sku: string; barcode_value: string; selling_price: number; quantity_on_hand: number }
type Product = { id: string; name: string; images: string[]; product_variants: Variant[] }

// Label stock presets. Sheet sizes match common A4 sticker sheets sold in Kenya.
const PRESETS = {
  a4_24: { label: 'A4 sheet · 24 per page (70 × 37 mm)', cols: 3, w: 70, h: 37, sheet: true },
  a4_40: { label: 'A4 sheet · 40 per page (48.5 × 25.4 mm)', cols: 4, w: 48.5, h: 25.4, sheet: true },
  thermal: { label: 'Label printer roll (50 × 30 mm)', cols: 1, w: 50, h: 30, sheet: false },
} as const
type Preset = keyof typeof PRESETS

export function LabelDesigner({ products, preselect, storeName }: { products: Product[]; preselect: string | null; storeName: string }) {
  const [q, setQ] = useState('')
  const [preset, setPreset] = useState<Preset>('a4_24')
  const [showPrice, setShowPrice] = useState(true)
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const p = products.find((x) => x.id === preselect)
    return p ? Object.fromEntries(p.product_variants.map((v) => [v.id, Math.max(1, v.quantity_on_hand)])) : {}
  })
  const all = useMemo(() => products.flatMap((p) => p.product_variants.map((v) => ({ ...v, product: p }))), [products])
  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.product_variants.some((v) => v.sku.toLowerCase().includes(q.toLowerCase()) || v.barcode_value.includes(q)))
  const labels = all.flatMap((v) => Array.from({ length: copies[v.id] ?? 0 }, (_, i) => ({ ...v, n: i })))
  const P = PRESETS[preset]
  const set = (id: string, n: number) => setCopies((c) => ({ ...c, [id]: Math.max(0, Math.min(500, n)) }))

  return (
    <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
      <style>{P.sheet ? `@page { size: A4; margin: 10mm 8mm }` : `@page { size: ${P.w}mm ${P.h}mm; margin: 0 }`}</style>
      <div className="no-print min-w-0 space-y-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <label className="label" htmlFor="preset">Label type</label>
          <select id="preset" className="field" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price on label</label>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm"><b>{labels.length}</b> label{labels.length === 1 ? '' : 's'}{P.sheet ? ` · ${Math.ceil(labels.length / (P.cols * Math.floor(277 / P.h)))} page(s)` : ''}</p>
            <button onClick={() => window.print()} disabled={!labels.length} className="btn btn-primary btn-sm"><Printer className="size-4" /> Print</button>
          </div>
          {labels.length > 0 && <button onClick={() => setCopies({})} className="mt-2 text-xs font-bold text-muted underline">Clear all</button>}
        </div>

        <div className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line p-3">
            <label className="relative block">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find product, SKU or barcode" className="field field-sm pl-9" />
            </label>
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {filtered.map((p) => (
              <li key={p.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-sand">{p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />}</div>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</p>
                  <button onClick={() => p.product_variants.forEach((v) => set(v.id, Math.max(1, v.quantity_on_hand)))} className="text-xs font-bold text-clay underline" title="One label per item in stock">= stock</button>
                </div>
                <ul className="mt-2 space-y-1 pl-13">
                  {p.product_variants.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{[v.size, v.colour].filter(Boolean).join(' / ') || 'Standard'} <span className="text-muted">· {v.quantity_on_hand} in stock</span></span>
                      <span className="flex items-center rounded-full border border-line">
                        <button onClick={() => set(v.id, (copies[v.id] ?? 0) - 1)} className="grid size-6 place-items-center" aria-label="Fewer"><Minus className="size-3" /></button>
                        <input value={copies[v.id] ?? 0} onChange={(e) => set(v.id, Number(e.target.value) || 0)} className="w-8 bg-transparent text-center font-bold" aria-label="Copies" inputMode="numeric" />
                        <button onClick={() => set(v.id, (copies[v.id] ?? 0) + 1)} className="grid size-6 place-items-center" aria-label="More"><Plus className="size-3" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-white p-4 print:overflow-visible print:rounded-none print:border-0 print:p-0">
        {labels.length === 0 ? (
          <p className="no-print py-20 text-center text-sm text-muted">Choose products on the left — label previews appear here.</p>
        ) : (
          <div className={cn(P.sheet ? 'grid gap-x-[2.5mm] gap-y-0' : 'flex flex-col')} style={P.sheet ? { gridTemplateColumns: `repeat(${P.cols}, ${P.w}mm)` } : undefined}>
            {labels.map((l) => (
              <div
                key={`${l.id}-${l.n}`}
                className={cn('flex flex-col items-center justify-between overflow-hidden bg-white px-[2mm] py-[1.5mm] text-center text-black', P.sheet ? 'outline outline-1 outline-dashed outline-stone print:outline-0' : 'break-after-page border border-dashed border-stone print:border-0')}
                style={{ width: `${P.w}mm`, height: `${P.h}mm` }}
              >
                <div className="w-full leading-none">
                  <p className="truncate text-[6pt] font-bold tracking-[0.15em] uppercase">{storeName}</p>
                  <p className="mt-[0.6mm] truncate text-[7.5pt] font-bold">{l.product.name}</p>
                  <p className="truncate text-[6.5pt]">{[l.size, l.colour].filter(Boolean).join(' · ')}{showPrice ? ` — ${formatKes(l.selling_price)}` : ''}</p>
                </div>
                <Barcode value={l.barcode_value} height={P.h > 30 ? 34 : 24} width={P.w > 60 ? 1.5 : 1.15} fontSize={10} className="h-auto max-h-[62%] max-w-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
