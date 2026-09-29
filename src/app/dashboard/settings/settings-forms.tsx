'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { Panel } from '@/components/dash/ui'
import { Switch } from '@/components/dash/switch'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { uploadProductImage } from '@/lib/image-upload'
import type { Tables } from '@/lib/supabase/database.types'
import { cn, formatDate, formatKes } from '@/lib/utils'
import { deleteCategory, deleteOption, saveCategory, saveCoupon, saveOption, saveSettings, saveZone } from './actions'

const s = (v: string | number | null | undefined) => (v == null ? '' : String(v))

function Text({ label, value, onChange, hint, type = 'text', placeholder, className }: { label: string; value: string; onChange: (v: string) => void; hint?: string; type?: string; placeholder?: string; className?: string }) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl bg-paper p-3 text-sm">
      <span><b>{label}</b>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

// ---------------------------------------------------------------------------
export function StoreSettings({ settings }: { settings: Tables<'store_settings'> }) {
  const { pending, run } = useAction()
  const [f, setF] = useState({
    store_name: settings.store_name, tagline: s(settings.tagline), phone: s(settings.phone), whatsapp: s(settings.whatsapp), email: s(settings.email),
    announcement: s(settings.announcement), instagram_url: s(settings.instagram_url), facebook_url: s(settings.facebook_url), tiktok_url: s(settings.tiktok_url),
    receipt_footer: s(settings.receipt_footer), return_window_days: s(settings.return_window_days), low_stock_default: s(settings.low_stock_default),
    mpesa_enabled: settings.mpesa_enabled, card_enabled: settings.card_enabled, cod_enabled: settings.cod_enabled, pickup_enabled: settings.pickup_enabled,
    pickup_address: s(settings.pickup_address), pickup_hours: s(settings.pickup_hours), free_delivery_threshold: s(settings.free_delivery_threshold),
  })
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="grid gap-6 pb-20 xl:grid-cols-2">
      <Panel title="Store details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Store name" value={f.store_name} onChange={set('store_name')} />
          <Text label="Tagline" value={f.tagline} onChange={set('tagline')} />
          <Text label="Phone" value={f.phone} onChange={set('phone')} placeholder="0712 345 678" />
          <Text label="WhatsApp number" value={f.whatsapp} onChange={set('whatsapp')} placeholder="0712 345 678" />
          <Text label="Email" value={f.email} onChange={set('email')} type="email" className="sm:col-span-2" />
          <Text label="Announcement bar" value={f.announcement} onChange={set('announcement')} className="sm:col-span-2" hint="Shown at the very top of the shop. Leave empty to hide." />
          <Text label="Instagram link" value={f.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/…" />
          <Text label="TikTok link" value={f.tiktok_url} onChange={set('tiktok_url')} placeholder="https://tiktok.com/@…" />
          <Text label="Facebook link" value={f.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/…" />
          <Text label="Receipt footer" value={f.receipt_footer} onChange={set('receipt_footer')} />
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Payments">
          <div className="space-y-2">
            <Toggle label="M-Pesa" hint="STK push to the customer’s phone (needs Daraja keys)" checked={f.mpesa_enabled} onChange={set('mpesa_enabled')} />
            <Toggle label="Card (Paystack)" hint="Only works once PAYSTACK_SECRET_KEY is configured" checked={f.card_enabled} onChange={set('card_enabled')} />
            <Toggle label="Cash on delivery" hint="Also switch it on per delivery area. Higher no-show risk." checked={f.cod_enabled} onChange={set('cod_enabled')} />
          </div>
        </Panel>
        <Panel title="Delivery & pickup">
          <div className="space-y-4">
            <Text label="Free delivery on orders over (KES)" value={f.free_delivery_threshold} onChange={set('free_delivery_threshold')} type="number" hint="Leave empty for no free delivery." />
            <Toggle label="Customers can pick up" checked={f.pickup_enabled} onChange={set('pickup_enabled')} />
            {f.pickup_enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Pickup address" value={f.pickup_address} onChange={set('pickup_address')} placeholder="Shop no., building, street, town" />
                <Text label="Opening hours" value={f.pickup_hours} onChange={set('pickup_hours')} placeholder="Mon–Sat 9am–7pm" />
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Policies & stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Return window (days)" value={f.return_window_days} onChange={set('return_window_days')} type="number" />
            <Text label="Default low-stock alert" value={f.low_stock_default} onChange={set('low_stock_default')} type="number" />
          </div>
        </Panel>
      </div>
      <div className="fixed right-6 bottom-6 z-20">
        <button disabled={pending} onClick={() => run(() => saveSettings(f))} className="btn btn-primary btn-lg shadow-lift">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function ZonesSettings({ zones }: { zones: Tables<'delivery_zones'>[] }) {
  const { pending, run } = useAction()
  const [edit, setEdit] = useState<null | { id?: string; name: string; description: string; fee: string; eta: string; cod_allowed: boolean; is_active: boolean; sort_order: string }>(null)
  return (
    <Panel title="Delivery areas & fees" padded={false} action={<button onClick={() => setEdit({ name: '', description: '', fee: '', eta: '', cod_allowed: false, is_active: true, sort_order: String(zones.length + 1) })} className="btn btn-primary btn-sm"><Plus className="size-4" /> Add area</button>}>
      <table className="table">
        <thead><tr><th>Area</th><th className="text-right">Fee</th><th>Delivery time</th><th>Cash on delivery</th><th>Active</th><th /></tr></thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className={cn(!z.is_active && 'opacity-50')}>
              <td><p className="font-semibold">{z.name}</p><p className="text-xs text-muted">{z.description}</p></td>
              <td className="text-right">{formatKes(z.fee)}</td>
              <td>{z.eta}</td>
              <td>{z.cod_allowed ? 'Allowed' : '—'}</td>
              <td>{z.is_active ? 'Yes' : 'No'}</td>
              <td><button onClick={() => setEdit({ id: z.id, name: z.name, description: s(z.description), fee: s(z.fee), eta: s(z.eta), cod_allowed: z.cod_allowed, is_active: z.is_active, sort_order: s(z.sort_order) })} className="btn-icon btn-ghost" aria-label="Edit"><Pencil className="size-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={edit != null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit delivery area' : 'New delivery area'}>
        {edit && (
          <div className="space-y-4">
            <Text label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} placeholder="e.g. Nairobi CBD" />
            <Text label="Which places does it cover?" value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
            <div className="grid grid-cols-3 gap-3">
              <Text label="Fee (KES)" value={edit.fee} onChange={(v) => setEdit({ ...edit, fee: v })} type="number" />
              <Text label="Time" value={edit.eta} onChange={(v) => setEdit({ ...edit, eta: v })} placeholder="1–2 days" />
              <Text label="Order" value={edit.sort_order} onChange={(v) => setEdit({ ...edit, sort_order: v })} type="number" />
            </div>
            <Toggle label="Allow cash on delivery here" checked={edit.cod_allowed} onChange={(v) => setEdit({ ...edit, cod_allowed: v })} />
            <Toggle label="Active" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
            <button disabled={pending} onClick={() => run(() => saveZone(edit), { onSuccess: () => setEdit(null) })} className="btn btn-primary w-full">Save</button>
          </div>
        )}
      </Modal>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
type Cat = Tables<'categories'> & { productCount: number }
export function CategoriesSettings({ categories }: { categories: Cat[] }) {
  const { pending, run } = useAction()
  const toast = useToast()
  const [edit, setEdit] = useState<null | { id?: string; name: string; parent_id: string; description: string; image_url: string; sort_order: string; is_active: boolean }>(null)
  const [uploading, setUploading] = useState(false)
  return (
    <Panel title="Categories" padded={false} action={<button onClick={() => setEdit({ name: '', parent_id: '', description: '', image_url: '', sort_order: String(categories.length + 1), is_active: true })} className="btn btn-primary btn-sm"><Plus className="size-4" /> Add category</button>}>
      <p className="border-b border-line px-5 py-3 text-xs text-muted">Add anything new you start stocking — shoes, jewellery, kids… It appears in the shop menu straight away. Sub-categories sit under a main one.</p>
      <table className="table">
        <thead><tr><th>Category</th><th>Products</th><th>Order</th><th>Visible</th><th /></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className={cn(!c.is_active && 'opacity-50')}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-sand">{c.image_url && <Image src={c.image_url} alt="" fill sizes="40px" className="object-cover" />}</div>
                  <div><p className="font-semibold">{c.parent_id ? `↳ ${c.name}` : c.name}</p><p className="text-xs text-muted">/shop/{c.slug}</p></div>
                </div>
              </td>
              <td>{c.productCount}</td>
              <td>{c.sort_order}</td>
              <td>{c.is_active ? 'Yes' : 'Hidden'}</td>
              <td className="text-right">
                <button onClick={() => setEdit({ id: c.id, name: c.name, parent_id: s(c.parent_id), description: s(c.description), image_url: s(c.image_url), sort_order: s(c.sort_order), is_active: c.is_active })} className="btn-icon btn-ghost" aria-label="Edit"><Pencil className="size-4" /></button>
                <button disabled={pending} onClick={() => confirm(`Delete ${c.name}?`) && run(() => deleteCategory(c.id))} className="btn-icon btn-ghost text-danger" aria-label="Delete"><Trash2 className="size-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={edit != null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'}>
        {edit && (
          <div className="space-y-4">
            <Text label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} placeholder="e.g. Shoes" />
            <div>
              <label className="label" htmlFor="cp">Belongs under</label>
              <select id="cp" className="field" value={edit.parent_id} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value })}>
                <option value="">— Main category —</option>
                {categories.filter((c) => !c.parent_id && c.id !== edit.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Text label="Short description" value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
            <div>
              <p className="label">Cover image (optional)</p>
              <div className="flex items-center gap-3">
                <div className="relative size-16 overflow-hidden rounded-xl bg-sand">{edit.image_url && <Image src={edit.image_url} alt="" fill sizes="64px" className="object-cover" />}</div>
                <label className="btn btn-light btn-sm cursor-pointer">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Upload
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploading(true)
                    try { setEdit({ ...edit, image_url: await uploadProductImage(file, 'categories') }) } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
                    setUploading(false)
                  }} />
                </label>
                {edit.image_url && <button onClick={() => setEdit({ ...edit, image_url: '' })} className="btn-icon btn-ghost" aria-label="Remove image"><X className="size-4" /></button>}
              </div>
            </div>
            <Text label="Menu order" value={edit.sort_order} onChange={(v) => setEdit({ ...edit, sort_order: v })} type="number" />
            <Toggle label="Visible in the shop" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
            <button disabled={pending || uploading} onClick={() => run(() => saveCategory(edit), { onSuccess: () => setEdit(null) })} className="btn btn-primary w-full">Save</button>
          </div>
        )}
      </Modal>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
export function OptionsSettings({ options }: { options: Tables<'attribute_options'>[] }) {
  const { pending, run } = useAction()
  const [size, setSize] = useState('')
  const [colour, setColour] = useState('')
  const [hex, setHex] = useState('#b4532a')
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Sizes">
        <div className="flex flex-wrap gap-2">
          {options.filter((o) => o.kind === 'size').map((o) => (
            <span key={o.id} className="chip border border-line bg-white px-3 py-1.5 text-sm">{o.value}<button onClick={() => confirm(`Remove size ${o.value}? Existing products keep it.`) && run(() => deleteOption(o.id))} aria-label={`Remove ${o.value}`}><X className="size-3.5 text-muted hover:text-danger" /></button></span>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input className="field field-sm max-w-48" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 38, 4XL, Kids 6" />
          <button disabled={pending || !size.trim()} onClick={() => run(() => saveOption('size', size, null), { onSuccess: () => setSize('') })} className="btn btn-primary btn-sm"><Plus className="size-4" /> Add</button>
        </div>
      </Panel>
      <Panel title="Colours">
        <div className="flex flex-wrap gap-2">
          {options.filter((o) => o.kind === 'colour').map((o) => (
            <span key={o.id} className="chip border border-line bg-white px-3 py-1.5 text-sm">
              <span className="size-3.5 rounded-full border border-black/10" style={{ background: o.hex ?? 'conic-gradient(#b4532a,#c49a4a,#2b56a8,#b4532a)' }} />{o.value}
              <button onClick={() => confirm(`Remove colour ${o.value}?`) && run(() => deleteOption(o.id))} aria-label={`Remove ${o.value}`}><X className="size-3.5 text-muted hover:text-danger" /></button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input className="field field-sm max-w-48" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. Emerald" />
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line" aria-label="Swatch colour" />
          <button disabled={pending || !colour.trim()} onClick={() => run(() => saveOption('colour', colour, hex), { onSuccess: () => setColour('') })} className="btn btn-primary btn-sm"><Plus className="size-4" /> Add</button>
        </div>
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function CouponsSettings({ coupons }: { coupons: Tables<'coupons'>[] }) {
  const { pending, run } = useAction()
  const blank = { code: '', description: '', type: 'percent' as 'percent' | 'fixed', value: '', min_subtotal: '0', max_uses: '', ends_at: '', is_active: true }
  const [edit, setEdit] = useState<null | (typeof blank & { id?: string })>(null)
  return (
    <Panel title="Discount codes" padded={false} action={<button onClick={() => setEdit(blank)} className="btn btn-primary btn-sm"><Plus className="size-4" /> New code</button>}>
      <table className="table">
        <thead><tr><th>Code</th><th>Discount</th><th>Minimum spend</th><th>Used</th><th>Ends</th><th>Active</th><th /></tr></thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id} className={cn(!c.is_active && 'opacity-50')}>
              <td><p className="font-mono font-bold">{c.code}</p><p className="text-xs text-muted">{c.description}</p></td>
              <td>{c.type === 'percent' ? `${c.value}%` : formatKes(c.value)}</td>
              <td>{Number(c.min_subtotal) ? formatKes(c.min_subtotal) : '—'}</td>
              <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
              <td>{c.ends_at ? formatDate(c.ends_at) : '—'}</td>
              <td>{c.is_active ? 'Yes' : 'No'}</td>
              <td><button onClick={() => setEdit({ id: c.id, code: c.code, description: s(c.description), type: c.type, value: s(c.value), min_subtotal: s(c.min_subtotal), max_uses: s(c.max_uses), ends_at: c.ends_at ? c.ends_at.slice(0, 10) : '', is_active: c.is_active })} className="btn-icon btn-ghost" aria-label="Edit"><Pencil className="size-4" /></button></td>
            </tr>
          ))}
          {!coupons.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-muted">No discount codes yet.</td></tr>}
        </tbody>
      </table>
      <Modal open={edit != null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit code' : 'New discount code'}>
        {edit && (
          <div className="space-y-4">
            <Text label="Code" value={edit.code} onChange={(v) => setEdit({ ...edit, code: v.toUpperCase() })} placeholder="KARIBU10" />
            <Text label="Description (staff only)" value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ct">Type</label>
                <select id="ct" className="field" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as 'percent' | 'fixed' })}><option value="percent">Percent off</option><option value="fixed">KES off</option></select>
              </div>
              <Text label={edit.type === 'percent' ? 'Percent' : 'Amount (KES)'} value={edit.value} onChange={(v) => setEdit({ ...edit, value: v })} type="number" />
              <Text label="Minimum spend (KES)" value={edit.min_subtotal} onChange={(v) => setEdit({ ...edit, min_subtotal: v })} type="number" />
              <Text label="Max uses (optional)" value={edit.max_uses} onChange={(v) => setEdit({ ...edit, max_uses: v })} type="number" />
            </div>
            <Text label="Ends on (optional)" value={edit.ends_at} onChange={(v) => setEdit({ ...edit, ends_at: v })} type="date" />
            <Toggle label="Active" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
            <button disabled={pending} onClick={() => run(() => saveCoupon(edit), { onSuccess: () => setEdit(null) })} className="btn btn-primary w-full">Save code</button>
          </div>
        )}
      </Modal>
    </Panel>
  )
}
