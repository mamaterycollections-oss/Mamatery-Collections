'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'motion/react'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Save, Trash2, Wand2, X } from 'lucide-react'
import { Switch } from '@/components/dash/switch'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { uploadProductImage } from '@/lib/image-upload'
import type { Tables } from '@/lib/supabase/database.types'
import { cn, formatKes } from '@/lib/utils'
import { deleteProduct, deleteVariant, saveProduct } from './actions'

type Row = {
  key: string
  id?: string
  size: string
  colour: string
  selling_price: string
  cost_price: string
  quantity_on_hand: string
  low_stock_threshold: string
  image_url: string | null
  is_active: boolean
  sku?: string
  barcode?: string
}

type Props = {
  categories: { id: string; name: string; parent_id: string | null }[]
  sizes: string[]
  colours: { value: string; hex: string | null }[]
  product: (Tables<'products'> & { product_variants: Tables<'product_variants'>[] }) | null
  costs: Record<string, number>
  perms: { margins: boolean; owner: boolean }
}

export function ProductEditor({ categories, sizes, colours, product, costs, perms }: Props) {
  const router = useRouter()
  const toast = useToast()
  const { pending, run } = useAction()
  const [id] = useState(() => product?.id ?? crypto.randomUUID())
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [basePrice, setBasePrice] = useState(product ? String(product.base_price) : '')
  const [comparePrice, setComparePrice] = useState(product?.compare_at_price != null ? String(product.compare_at_price) : '')
  const [tags, setTags] = useState((product?.tags ?? []).filter((t) => t !== 'demo').join(', '))
  const [active, setActive] = useState(product?.is_active ?? true)
  const [featured, setFeatured] = useState(product?.is_featured ?? false)
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>(
    (product?.product_variants ?? [])
      .sort((a, b) => (a.colour ?? '').localeCompare(b.colour ?? '') || sizes.indexOf(a.size ?? '') - sizes.indexOf(b.size ?? ''))
      .map((v) => ({
        key: v.id, id: v.id, size: v.size ?? '', colour: v.colour ?? '', selling_price: String(v.selling_price),
        cost_price: costs[v.id] != null ? String(costs[v.id]) : '', quantity_on_hand: String(v.quantity_on_hand),
        low_stock_threshold: String(v.low_stock_threshold), image_url: v.image_url, is_active: v.is_active, sku: v.sku, barcode: v.barcode_value,
      })),
  )
  const [pickSizes, setPickSizes] = useState<string[]>([])
  const [pickColours, setPickColours] = useState<string[]>([])
  const [customSize, setCustomSize] = useState('')
  const [customColour, setCustomColour] = useState('')
  const hex = useMemo(() => Object.fromEntries(colours.map((c) => [c.value, c.hex])), [colours])

  const upload = async (files: FileList | File[]) => {
    const list = [...files].slice(0, 12 - images.length)
    setUploading((n) => n + list.length)
    for (const f of list) {
      try {
        const url = await uploadProductImage(f, `products/${id}`)
        setImages((imgs) => [...imgs, url])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const generate = () => {
    const s = pickSizes.length ? pickSizes : ['']
    const c = pickColours.length ? pickColours : ['']
    const existing = new Set(rows.map((r) => `${r.size}|${r.colour}`.toLowerCase()))
    const fresh: Row[] = []
    for (const colour of c)
      for (const size of s) {
        if (existing.has(`${size}|${colour}`.toLowerCase())) continue
        fresh.push({
          key: crypto.randomUUID(), size, colour, selling_price: basePrice || '', cost_price: '', quantity_on_hand: '0',
          low_stock_threshold: '3', image_url: null, is_active: true,
        })
      }
    if (!fresh.length) toast.toast({ tone: 'info', title: 'Those combinations already exist' })
    setRows((r) => [...r, ...fresh])
    setPickSizes([])
    setPickColours([])
  }
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const applyAll = (field: 'selling_price' | 'cost_price' | 'low_stock_threshold', value: string) => setRows((rs) => rs.map((r) => ({ ...r, [field]: value })))

  const save = () => {
    if (!name.trim()) return toast.error('Give the product a name')
    if (!rows.length) return toast.error('Add at least one size/colour below')
    const bad = rows.find((r) => r.selling_price === '' || Number(r.selling_price) < 0)
    if (bad) return toast.error(`Set a price for ${[bad.size, bad.colour].filter(Boolean).join(' / ') || 'every variant'}`)
    run(
      () =>
        saveProduct(
          {
            id, name, category_id: categoryId, description, base_price: Number(basePrice || rows[0].selling_price || 0),
            compare_at_price: comparePrice ? Number(comparePrice) : null, images,
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean).concat(product?.tags.includes('demo') ? ['demo'] : []),
            is_active: active, is_featured: featured,
          },
          rows.map((r) => ({
            id: r.id, size: r.size || null, colour: r.colour || null, selling_price: Number(r.selling_price),
            cost_price: perms.margins && r.cost_price !== '' ? Number(r.cost_price) : null,
            quantity_on_hand: r.id ? undefined : Number(r.quantity_on_hand || 0),
            low_stock_threshold: Number(r.low_stock_threshold || 0), image_url: r.image_url, is_active: r.is_active,
          })),
        ),
      { onSuccess: () => !product && router.push(`/dashboard/products/${id}`) },
    )
  }

  const margin = (r: Row) => {
    const p = Number(r.selling_price)
    const c = Number(r.cost_price)
    if (!p || r.cost_price === '') return null
    return ((p - c) / p) * 100
  }

  return (
    <div className="grid gap-6 pb-24 xl:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 font-bold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-name">Product name</label>
              <input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amani Wrap Midi Dress" />
            </div>
            <div>
              <label className="label" htmlFor="p-cat">Category</label>
              <select id="p-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-tags">Tags <span className="font-normal text-muted">(comma separated, helps search)</span></label>
              <input id="p-tags" className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="linen, summer, office" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-desc">Description</label>
              <textarea id="p-desc" rows={5} className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fabric, fit, how to style it, care instructions…" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Photos</h2>
            <p className="text-xs text-muted">Drag to reorder · first photo is the cover</p>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files) }}
            className={cn('rounded-2xl border-2 border-dashed p-3 transition', dragOver ? 'border-clay bg-clay-soft' : 'border-line')}
          >
            <Reorder.Group axis="x" values={images} onReorder={setImages} className="flex flex-wrap gap-3">
              {images.map((src, i) => (
                <Reorder.Item key={src} value={src} className="group relative h-36 w-28 cursor-grab overflow-hidden rounded-xl bg-sand active:cursor-grabbing">
                  <Image src={src} alt="" fill sizes="112px" className="pointer-events-none object-cover" />
                  {i === 0 && <span className="absolute top-1.5 left-1.5 chip bg-ink text-[0.6rem] text-white">Cover</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 p-1.5 opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={() => i > 0 && setImages((im) => { const n = [...im]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })} className="grid size-6 place-items-center rounded-full bg-white/90" aria-label="Move left"><ChevronLeft className="size-3.5" /></button>
                    <button type="button" onClick={() => setImages((im) => im.filter((x) => x !== src))} className="grid size-6 place-items-center rounded-full bg-white/90 text-danger" aria-label="Remove photo"><Trash2 className="size-3.5" /></button>
                    <button type="button" onClick={() => i < images.length - 1 && setImages((im) => { const n = [...im]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })} className="grid size-6 place-items-center rounded-full bg-white/90" aria-label="Move right"><ChevronRight className="size-3.5" /></button>
                  </div>
                </Reorder.Item>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <div key={`u${i}`} className="skeleton grid h-36 w-28 place-items-center rounded-xl"><Loader2 className="size-5 animate-spin text-muted" /></div>
              ))}
              {images.length < 12 && (
                <button type="button" onClick={() => fileInput.current?.click()} className="grid h-36 w-28 place-items-center rounded-xl border border-line bg-paper text-muted transition hover:border-ink hover:text-ink">
                  <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus className="size-6" /> Add photos</span>
                </button>
              )}
            </Reorder.Group>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
          </div>
          <p className="mt-2 text-xs text-muted">Tip: clear photos on a plain background sell best. Photos are resized automatically.</p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">Sizes &amp; colours</h2>
          <p className="mt-1 text-sm text-muted">Each size/colour combination is a variant with its own stock, SKU and barcode.</p>

          <div className="mt-4 rounded-2xl bg-paper p-4">
            <p className="label">Sizes</p>
            <div className="flex flex-wrap gap-1.5">
              {[...sizes, ...pickSizes.filter((s) => !sizes.includes(s))].map((s) => (
                <Chip key={s} on={pickSizes.includes(s)} onClick={() => setPickSizes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}>{s}</Chip>
              ))}
              <input value={customSize} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customSize.trim()) { e.preventDefault(); setPickSizes((p) => [...p, customSize.trim()]); setCustomSize('') } }} placeholder="+ other (e.g. 38)" className="field field-sm w-32" />
            </div>
            <p className="label mt-4">Colours</p>
            <div className="flex flex-wrap gap-1.5">
              {[...colours.map((c) => c.value), ...pickColours.filter((c) => !hex[c] && !colours.some((x) => x.value === c))].map((c) => (
                <Chip key={c} on={pickColours.includes(c)} onClick={() => setPickColours((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}>
                  <span className="size-3 rounded-full border border-black/10" style={{ background: hex[c] ?? 'conic-gradient(#b4532a,#c49a4a,#2b56a8,#b4532a)' }} /> {c}
                </Chip>
              ))}
              <input value={customColour} onChange={(e) => setCustomColour(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customColour.trim()) { e.preventDefault(); setPickColours((p) => [...p, customColour.trim()]); setCustomColour('') } }} placeholder="+ other colour" className="field field-sm w-36" />
            </div>
            <button type="button" onClick={generate} disabled={!pickSizes.length && !pickColours.length} className="btn btn-primary btn-sm mt-4">
              <Wand2 className="size-4" /> Add {Math.max(1, pickSizes.length) * Math.max(1, pickColours.length)} variant{Math.max(1, pickSizes.length) * Math.max(1, pickColours.length) === 1 ? '' : 's'}
            </button>
            <button type="button" onClick={() => setRows((r) => [...r, { key: crypto.randomUUID(), size: '', colour: '', selling_price: basePrice, cost_price: '', quantity_on_hand: '0', low_stock_threshold: '3', image_url: null, is_active: true }])} className="btn btn-ghost btn-sm mt-4">
              <Plus className="size-4" /> Single variant
            </button>
          </div>

          {rows.length > 0 && (
            <div className="-mx-5 mt-5 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Size</th><th>Colour</th>
                    <th>Price <ApplyAll onApply={(v) => applyAll('selling_price', v)} /></th>
                    {perms.margins && <th>Cost <ApplyAll onApply={(v) => applyAll('cost_price', v)} /></th>}
                    {perms.margins && <th>Margin</th>}
                    <th>Stock</th>
                    <th>Alert at <ApplyAll onApply={(v) => applyAll('low_stock_threshold', v)} /></th>
                    <th>Photo</th><th>Barcode / SKU</th><th>On</th><th />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((r) => {
                      const m = margin(r)
                      return (
                        <motion.tr key={r.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn(!r.is_active && 'opacity-50')}>
                          <td><input className="field field-sm w-20" value={r.size} onChange={(e) => update(r.key, { size: e.target.value })} aria-label="Size" /></td>
                          <td><input className="field field-sm w-28" value={r.colour} onChange={(e) => update(r.key, { colour: e.target.value })} aria-label="Colour" /></td>
                          <td><input className="field field-sm w-24" type="number" min={0} value={r.selling_price} onChange={(e) => update(r.key, { selling_price: e.target.value })} aria-label="Selling price" /></td>
                          {perms.margins && <td><input className="field field-sm w-24" type="number" min={0} value={r.cost_price} onChange={(e) => update(r.key, { cost_price: e.target.value })} aria-label="Cost price" placeholder="—" /></td>}
                          {perms.margins && <td className={cn('text-xs font-bold', m == null ? 'text-muted' : m < 20 ? 'text-danger' : m < 40 ? 'text-warning' : 'text-success')}>{m == null ? '—' : `${m.toFixed(0)}%`}</td>}
                          <td>
                            {r.id ? (
                              <a href={`/dashboard/inventory?q=${r.sku}`} className="font-bold underline-offset-2 hover:underline" title="Change stock in Inventory">{r.quantity_on_hand}</a>
                            ) : (
                              <input className="field field-sm w-20" type="number" min={0} value={r.quantity_on_hand} onChange={(e) => update(r.key, { quantity_on_hand: e.target.value })} aria-label="Opening stock" />
                            )}
                          </td>
                          <td><input className="field field-sm w-16" type="number" min={0} value={r.low_stock_threshold} onChange={(e) => update(r.key, { low_stock_threshold: e.target.value })} aria-label="Low stock alert level" /></td>
                          <td>
                            <select className="field field-sm w-24" value={r.image_url ?? ''} onChange={(e) => update(r.key, { image_url: e.target.value || null })} aria-label="Variant photo">
                              <option value="">Default</option>
                              {images.map((src, i) => <option key={src} value={src}>Photo {i + 1}</option>)}
                            </select>
                          </td>
                          <td className="font-mono text-[0.7rem] leading-tight text-muted">{r.barcode ? <>{r.barcode}<br />{r.sku}</> : 'auto on save'}</td>
                          <td><Switch checked={r.is_active} onChange={(v) => update(r.key, { is_active: v })} label="Available" /></td>
                          <td>
                            <button
                              type="button"
                              onClick={() => (r.id ? perms.owner && confirm('Delete this variant permanently?') && run(() => deleteVariant(r.id!), { onSuccess: () => setRows((rs) => rs.filter((x) => x.key !== r.key)) }) : setRows((rs) => rs.filter((x) => x.key !== r.key)))}
                              className="text-muted hover:text-danger disabled:opacity-30"
                              disabled={Boolean(r.id) && !perms.owner}
                              aria-label="Remove variant"
                              title={r.id ? 'Owner can delete unsold variants; otherwise switch it off' : 'Remove'}
                            >
                              <X className="size-4" />
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
          {rows.some((r) => r.id) && <p className="mt-3 text-xs text-muted">To change stock for existing variants use Inventory (restock / adjust) so every movement is recorded.</p>}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 font-bold">Pricing</h2>
          <label className="label" htmlFor="p-price">Default price (KES)</label>
          <input id="p-price" type="number" min={0} className="field" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="e.g. 2500" />
          <p className="hint">Used for new variants. Each variant can have its own price.</p>
          <label className="label mt-4" htmlFor="p-compare">Was price (optional)</label>
          <input id="p-compare" type="number" min={0} className="field" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} placeholder="Shows a sale badge" />
          {comparePrice && basePrice && Number(comparePrice) > Number(basePrice) && (
            <p className="hint text-clay">Shows as {Math.round((1 - Number(basePrice) / Number(comparePrice)) * 100)}% off (was {formatKes(comparePrice)})</p>
          )}
        </section>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">Visibility</h2>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Visible in the shop</span><Switch checked={active} onChange={setActive} label="Visible in the shop" /></label>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Feature on home page</span><Switch checked={featured} onChange={setFeatured} label="Featured" /></label>
        </section>
        <div className="sticky bottom-4 space-y-2">
          <button onClick={save} disabled={pending || uploading > 0} className="btn btn-primary btn-lg w-full shadow-lift">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {product ? 'Save changes' : 'Create product'}
          </button>
          {product && perms.owner && (
            <button onClick={() => confirm('Delete this product? This can’t be undone.') && run(() => deleteProduct(product.id), { onSuccess: () => router.push('/dashboard/products'), refresh: false })} className="btn btn-ghost w-full text-danger">
              <Trash2 className="size-4" /> Delete product
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition', on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink')}>
      {children}
    </button>
  )
}

function ApplyAll({ onApply }: { onApply: (v: string) => void }) {
  return (
    <button type="button" onClick={() => { const v = prompt('Set this value for every variant:'); if (v != null && v !== '') onApply(v) }} className="ml-1 text-[0.6rem] font-bold text-clay normal-case underline" title="Apply to all rows">
      all
    </button>
  )
}
