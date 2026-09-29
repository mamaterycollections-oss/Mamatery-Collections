'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAction } from '@/components/dash/use-action'
import { formatDateTime, formatKes } from '@/lib/utils'
import { closeDrawer, openDrawer } from '../pos/actions'

export function DrawerControls({ session }: { session: { id: string; float: number; openedAt: string; sales: number; expected: number } | null }) {
  const { pending, run } = useAction()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<{ expected: number; counted: number; discrepancy: number } | null>(null)

  if (result) {
    const d = Number(result.discrepancy)
    return (
      <div className={`rounded-2xl p-5 ${Math.abs(d) < 1 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
        <p className="font-display text-2xl">{Math.abs(d) < 1 ? 'Drawer balanced ✓' : d < 0 ? `Short by ${formatKes(-d)}` : `Over by ${formatKes(d)}`}</p>
        <p className="mt-1 text-sm">Expected {formatKes(result.expected)} · counted {formatKes(result.counted)}{Math.abs(d) >= 1 ? ' · the owner has been notified.' : ''}</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="fl">Opening cash (float)</label>
          <input id="fl" type="number" min={0} className="field w-44" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2000" />
        </div>
        <button disabled={pending} onClick={() => run(() => openDrawer(Number(amount) || 0), { onSuccess: () => setAmount('') })} className="btn btn-primary">
          {pending && <Loader2 className="size-4 animate-spin" />} Open drawer
        </button>
      </div>
    )
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Float</dt><dd className="font-bold">{formatKes(session.float)}</dd></div>
        <div className="rounded-xl bg-paper p-3"><dt className="text-xs text-muted">Cash sales</dt><dd className="font-bold">{formatKes(session.sales)}</dd></div>
        <div className="rounded-xl bg-ink p-3 text-white"><dt className="text-xs text-paper/60">Should be in drawer</dt><dd className="font-bold">{formatKes(session.expected)}</dd></div>
        <p className="col-span-3 text-xs text-muted">Opened {formatDateTime(session.openedAt)}</p>
      </dl>
      <div>
        <label className="label" htmlFor="cnt">Cash counted now</label>
        <input id="cnt" type="number" min={0} className="field text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Count every note and coin" />
        <label className="label mt-3" htmlFor="nt">Notes</label>
        <input id="nt" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — e.g. paid a supplier KES 500 from the drawer" />
        <button disabled={pending || amount === ''} onClick={() => run(() => closeDrawer(session.id, Number(amount), notes), { onSuccess: (r) => r && setResult(r) })} className="btn btn-primary mt-4">
          {pending && <Loader2 className="size-4 animate-spin" />} Close drawer
        </button>
      </div>
    </div>
  )
}
