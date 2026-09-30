'use client'

import { useState } from 'react'
import { Copy, KeyRound, Loader2, Pencil, UserPlus } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { Panel } from '@/components/dash/ui'
import { Switch } from '@/components/dash/switch'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { cn, ROLE_LABEL } from '@/lib/utils'
import { createStaff, resetStaffPassword, setStaffActive, updateStaff } from './actions'

type Staff = { userId: string; name: string; email: string; phone: string; role: 'sales_manager' | 'sales_attendant'; categories: string[]; margins: boolean; discount: number; active: boolean }
type Form = { full_name: string; email: string; phone: string; password: string; role: Staff['role']; categories: string[]; margins: boolean; discount: string }
const blank: Form = { full_name: '', email: '', phone: '', password: '', role: 'sales_attendant', categories: [], margins: false, discount: '5' }

export function TeamManager({ staff, categories }: { staff: Staff[]; categories: { id: string; name: string }[] }) {
  const { pending, run } = useAction()
  const toast = useToast()
  const [editing, setEditing] = useState<Staff | 'new' | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null)
  const [resetting, setResetting] = useState<Staff | null>(null)
  const [newPw, setNewPw] = useState('')
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?'

  const open = (s: Staff | 'new') => {
    setEditing(s)
    setForm(s === 'new' ? blank : { full_name: s.name, email: s.email, phone: s.phone, password: '', role: s.role, categories: s.categories, margins: s.margins, discount: String(s.discount) })
  }
  const submit = () => {
    const perms = { role: form.role, assigned_category_ids: form.categories, can_view_margins: form.margins, discount_limit_pct: Number(form.discount) || 0 }
    if (editing === 'new') {
      run(() => createStaff({ ...perms, full_name: form.full_name, email: form.email, phone: form.phone, password: form.password }), {
        onSuccess: (d) => {
          setEditing(null)
          if (d?.password) setSecret({ email: form.email, password: d.password })
          else toast.success('Existing account promoted to staff', form.password ? 'They already had an account, so their own password was kept.' : 'They sign in with their current password.')
        },
      })
    } else if (editing) {
      run(() => updateStaff(editing.userId, perms), { onSuccess: () => setEditing(null) })
    }
  }

  return (
    <Panel title="Staff accounts" padded={false} action={<button onClick={() => open('new')} className="btn btn-primary btn-sm"><UserPlus className="size-4" /> Add staff</button>}>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Categories</th><th>Discount limit</th><th>Sees margins</th><th>Active</th><th /></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.userId} className={cn(!s.active && 'opacity-60')}>
                <td><p className="font-semibold">{s.name}</p><p className="text-xs text-muted">{s.email}{s.phone ? ` · ${s.phone}` : ''}</p></td>
                <td>{ROLE_LABEL[s.role]}</td>
                <td className="max-w-48 text-xs">{s.role === 'sales_manager' ? (s.categories.length ? s.categories.map(catName).join(', ') : 'Whole catalog') : '—'}</td>
                <td>{s.discount}%</td>
                <td>{s.role === 'sales_manager' ? (s.margins ? 'Yes' : 'No') : '—'}</td>
                <td><Switch checked={s.active} disabled={pending} onChange={(v) => (v || confirm(`Deactivate ${s.name}? They will be signed out and can’t log in.`)) && run(() => setStaffActive(s.userId, v))} label="Active" /></td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => open(s)} className="btn-icon btn-ghost" aria-label="Edit permissions" title="Edit permissions"><Pencil className="size-4" /></button>
                    <button onClick={() => { setNewPw(''); setResetting(s) }} className="btn-icon btn-ghost" aria-label="Reset password" title="Reset password"><KeyRound className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!staff.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-muted">No staff yet — add your sales managers and attendants.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a staff member' : `Edit ${editing?.name ?? ''}`}>
        <div className="space-y-4">
          {editing === 'new' && (
            <>
              <div><label className="label" htmlFor="sn">Full name</label><input id="sn" className="field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="se">Email (their login)</label><input id="se" type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label" htmlFor="sp">Phone</label><input id="sp" type="tel" className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div>
                <label className="label" htmlFor="spw">Password <span className="font-normal text-muted">(optional)</span></label>
                <input id="spw" type="text" autoComplete="off" spellCheck={false} className="field" placeholder="Leave blank to generate one" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="hint">At least 8 characters. They’ll be asked to change it after signing in.</p>
              </div>
            </>
          )}
          <div>
            <p className="label">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(['sales_attendant', 'sales_manager'] as const).map((r) => (
                <button key={r} type="button" onClick={() => setForm({ ...form, role: r })} className={cn('rounded-xl border p-3 text-left text-sm', form.role === r ? 'border-ink ring-1 ring-ink' : 'border-line')}>
                  <b>{ROLE_LABEL[r]}</b>
                  <span className="block text-xs text-muted">{r === 'sales_manager' ? 'Catalog, stock, orders, reports' : 'Quick sale (POS) only'}</span>
                </button>
              ))}
            </div>
          </div>
          {form.role === 'sales_manager' && (
            <>
              <div>
                <p className="label">Categories they manage <span className="font-normal text-muted">(none selected = all)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const on = form.categories.includes(c.id)
                    return <button type="button" key={c.id} onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c.id) : [...form.categories, c.id] })} className={cn('rounded-full border px-3 py-1.5 text-xs font-bold', on ? 'border-ink bg-ink text-white' : 'border-line')}>{c.name}</button>
                  })}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3 text-sm">
                <span><b>Can see cost prices &amp; profit</b><span className="block text-xs text-muted">Margins, cost values and profit reports</span></span>
                <Switch checked={form.margins} onChange={(v) => setForm({ ...form, margins: v })} label="Can see margins" />
              </label>
            </>
          )}
          <div>
            <label className="label" htmlFor="sd">Maximum discount they can give (%)</label>
            <input id="sd" type="number" min={0} max={100} className="field" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </div>
          <button disabled={pending} onClick={submit} className="btn btn-primary w-full">{pending && <Loader2 className="size-4 animate-spin" />} {editing === 'new' ? 'Create account' : 'Save'}</button>
        </div>
      </Modal>

      <Modal open={resetting != null} onClose={() => setResetting(null)} title={`Reset ${resetting?.name ?? ''}’s password`}>
        <label className="label" htmlFor="rpw">New password <span className="font-normal text-muted">(optional)</span></label>
        <input id="rpw" type="text" autoComplete="off" spellCheck={false} className="field" placeholder="Leave blank to generate one" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <p className="hint">At least 8 characters. Their old password stops working, and they’ll be asked to change this one after signing in.</p>
        <button
          disabled={pending}
          onClick={() => {
            const s = resetting
            if (s) run(() => resetStaffPassword(s.userId, newPw), { refresh: false, onSuccess: (d) => { setResetting(null); if (d) setSecret({ email: s.email, password: d.password }) } })
          }}
          className="btn btn-primary mt-4 w-full"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Reset password
        </button>
      </Modal>

      <Modal open={secret != null} onClose={() => setSecret(null)} title="Login details">
        <p className="text-sm text-muted">Share these privately (e.g. in person or WhatsApp). This password is shown only once. They’ll be asked to change it after signing in.</p>
        <div className="mt-4 space-y-2 rounded-2xl bg-paper p-4 font-mono text-sm">
          <p>Email: {secret?.email}</p>
          <p>Password: <b>{secret?.password}</b></p>
          <p>Sign in at: {typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}</p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(`MamaTerryCollections staff login\nEmail: ${secret?.email}\nPassword: ${secret?.password}\n${window.location.origin}/login`); toast.success('Copied') }} className="btn btn-light mt-4 w-full"><Copy className="size-4" /> Copy</button>
      </Modal>
    </Panel>
  )
}
