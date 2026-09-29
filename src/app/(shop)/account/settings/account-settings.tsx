'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import { PushToggle } from '@/app/dashboard/notifications/notification-controls'
import { Modal } from '@/components/dash/modal'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { changePassword, deleteMyAccount, updateProfile } from '../actions'

export function AccountSettings({ profile, isStaff }: { profile: { full_name: string; phone: string; email: string; marketing_opt_in: boolean }; isStaff: boolean }) {
  const { pending, run } = useAction()
  const toast = useToast()
  const [p, setP] = useState(profile)
  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [del, setDel] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, startDelete] = useTransition()

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="an">Full name</label><input id="an" className="field" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
          <div><label className="label" htmlFor="ap">Phone</label><input id="ap" type="tel" className="field" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="ae">Email</label><input id="ae" className="field" value={p.email} disabled /><p className="hint">Contact us to change the email you sign in with.</p></div>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={p.marketing_opt_in} onChange={(e) => setP({ ...p, marketing_opt_in: e.target.checked })} /> Send me new arrivals and offers</label>
        <button disabled={pending} onClick={() => run(() => updateProfile(p))} className="btn btn-primary mt-5">Save details</button>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">Notifications</h2>
        <p className="mt-1 text-sm text-muted">Get order updates as notifications on this phone or computer.</p>
        <div className="mt-4"><PushToggle /></div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">Change password</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="password" autoComplete="new-password" className="field" placeholder="New password (8+ characters)" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} aria-label="New password" />
          <input type="password" autoComplete="new-password" className="field" placeholder="Type it again" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-label="Confirm password" />
        </div>
        <button disabled={pending || !pw.password} onClick={() => run(() => changePassword(pw.password, pw.confirm), { onSuccess: () => setPw({ password: '', confirm: '' }), refresh: false })} className="btn btn-light mt-4">Update password</button>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">Your data</h2>
        <p className="mt-1 text-sm text-muted">Download a copy of your profile, addresses, orders and reviews.</p>
        <a href="/account/export" className="btn btn-light mt-4"><Download className="size-4" /> Download my data</a>
      </section>

      {!isStaff && (
        <section className="rounded-3xl border border-danger/20 bg-danger-soft/40 p-6">
          <h2 className="font-display text-2xl text-danger">Delete account</h2>
          <p className="mt-1 text-sm text-muted">Permanently removes your account, saved addresses, wishlist and reviews. Past orders are kept anonymously for our accounting records.</p>
          <button onClick={() => setDel(true)} className="btn btn-danger mt-4">Delete my account</button>
        </section>
      )}

      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <p className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> This can’t be undone.</p>
        <label className="label mt-4" htmlFor="dc">Type DELETE to confirm</label>
        <input id="dc" className="field uppercase" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <button
          disabled={deleting || confirmText.trim().toUpperCase() !== 'DELETE'}
          onClick={() => startDelete(async () => {
            const r = await deleteMyAccount(confirmText)
            if (r && 'error' in r) toast.error(r.error)
          })}
          className="btn btn-danger mt-4 w-full"
        >
          {deleting && <Loader2 className="size-4 animate-spin" />} Permanently delete
        </button>
      </Modal>
    </div>
  )
}
