'use client'

import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { useAction } from '@/components/dash/use-action'
import type { Tables } from '@/lib/supabase/database.types'
import { deleteAddress, saveAddress } from '../actions'

type Form = { id?: string; label: string; recipient_name: string; phone: string; zone_id: string; address_line: string; landmark: string; is_default: boolean }

export function AddressBook({ addresses, zones }: { addresses: Tables<'customer_addresses'>[]; zones: { id: string; name: string }[] }) {
  const { pending, run } = useAction()
  const [f, setF] = useState<Form | null>(null)
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">Saved addresses</h2>
        <button onClick={() => setF({ label: '', recipient_name: '', phone: '', zone_id: zones[0]?.id ?? '', address_line: '', landmark: '', is_default: !addresses.length })} className="btn btn-primary btn-sm"><Plus className="size-4" /> Add address</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 font-bold"><MapPin className="size-4 text-clay" /> {a.label || a.recipient_name}</p>
              {a.is_default && <span className="chip bg-sand">Default</span>}
            </div>
            <p className="mt-2 text-sm">{a.recipient_name} · {a.phone}</p>
            <p className="text-sm text-muted">{a.address_line}{a.landmark ? ` (${a.landmark})` : ''}</p>
            <p className="text-sm text-muted">{zoneName(a.zone_id)}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setF({ id: a.id, label: a.label ?? '', recipient_name: a.recipient_name, phone: a.phone, zone_id: a.zone_id ?? '', address_line: a.address_line, landmark: a.landmark ?? '', is_default: a.is_default })} className="btn btn-light btn-sm"><Pencil className="size-3.5" /> Edit</button>
              <button onClick={() => confirm('Delete this address?') && run(() => deleteAddress(a.id))} className="btn btn-ghost btn-sm text-danger"><Trash2 className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {!addresses.length && <p className="text-sm text-muted">No saved addresses. They’re also saved automatically when you check out.</p>}
      </div>
      <Modal open={f != null} onClose={() => setF(null)} title={f?.id ? 'Edit address' : 'New address'}>
        {f && (
          <div className="space-y-3">
            <input className="field" placeholder="Label (e.g. Home, Office)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} aria-label="Label" />
            <input className="field" placeholder="Recipient name" value={f.recipient_name} onChange={(e) => setF({ ...f, recipient_name: e.target.value })} aria-label="Recipient name" />
            <input className="field" type="tel" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Phone" />
            <select className="field" value={f.zone_id} onChange={(e) => setF({ ...f, zone_id: e.target.value })} aria-label="Delivery area">
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <input className="field" placeholder="Estate, street, building, house no." value={f.address_line} onChange={(e) => setF({ ...f, address_line: e.target.value })} aria-label="Address" />
            <input className="field" placeholder="Landmark (optional)" value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} aria-label="Landmark" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} /> Use as my default address</label>
            <button disabled={pending} onClick={() => run(() => saveAddress(f), { onSuccess: () => setF(null) })} className="btn btn-primary w-full">Save address</button>
          </div>
        )}
      </Modal>
    </>
  )
}
