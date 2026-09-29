'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { History, Loader2, PackageMinus, PackagePlus } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { StockBadge } from '@/components/dash/ui'
import { useAction } from '@/components/dash/use-action'
import type { Enums } from '@/lib/supabase/database.types'
import { cn, formatDateTime, formatKes, STOCK_REASON_LABEL } from '@/lib/utils'
import { adjustStock, receiveStock, stockHistory } from './actions'

type Row = { id: string; sku: string; barcode: string; label: string; name: string; image: string | null; category: string; qty: number; threshold: number; price: number; cost: number | null; productId: string }
type History = Awaited<ReturnType<typeof stockHistory>>

export function InventoryTable({ rows, margins }: { rows: Row[]; margins: boolean }) {
  const { pending, run } = useAction()
  const [mode, setMode] = useState<null | { kind: 'restock' | 'adjust' | 'history'; row: Row }>(null)
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [direction, setDirection] = useState<'remove' | 'add'>('remove')
  const [reason, setReason] = useState<Enums<'stock_reason'>>('damage')
  const [history, setHistory] = useState<History | null>(null)
  const [loadingHistory, startHistory] = useTransition()

  const open = (kind: 'restock' | 'adjust' | 'history', row: Row) => {
    setMode({ kind, row })
    setQty('')
    setCost(row.cost != null ? String(row.cost) : '')
    setNote('')
    setDirection('remove')
    setReason('damage')
    if (kind === 'history') {
      setHistory(null)
      startHistory(async () => setHistory(await stockHistory(row.id)))
    }
  }
  const close = () => setMode(null)
  const row = mode?.row

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>SKU / barcode</th><th>Stock</th><th className="text-right">Price</th>{margins && <th className="text-right">Cost</th>}<th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/dashboard/products/${r.productId}`} className="flex items-center gap-3">
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-sand">{r.image && <Image src={r.image} alt="" fill sizes="44px" className="object-cover" />}</div>
                      <div className="min-w-0">
                        <p className="max-w-56 truncate font-semibold">{r.name}</p>
                        <p className="text-xs text-muted">{r.label || 'Standard'} · {r.category}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="font-mono text-xs leading-tight">{r.sku}<br /><span className="text-muted">{r.barcode}</span></td>
                  <td><StockBadge qty={r.qty} threshold={r.threshold} /></td>
                  <td className="text-right">{formatKes(r.price)}</td>
                  {margins && <td className="text-right text-muted">{r.cost != null ? formatKes(r.cost) : '—'}</td>}
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => open('restock', r)} className="btn btn-light btn-sm" title="Receive stock"><PackagePlus className="size-4" /> Restock</button>
                      <button onClick={() => open('adjust', r)} className="btn-icon btn-ghost" title="Adjust (damage, loss, correction)" aria-label="Adjust stock"><PackageMinus className="size-4" /></button>
                      <button onClick={() => open('history', r)} className="btn-icon btn-ghost" title="Stock history" aria-label="Stock history"><History className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={mode?.kind === 'restock'} onClose={close} title="Receive stock">
        {row && (
          <>
            <p className="text-sm"><b>{row.name}</b> · {row.label || 'Standard'} <span className="text-muted">· {row.qty} in stock now</span></p>
            <label className="label mt-4" htmlFor="rq">Quantity received</label>
            <input id="rq" type="number" min={1} className="field text-lg" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            {margins && (
              <>
                <label className="label mt-4" htmlFor="rc">Cost price per item for this batch (KES)</label>
                <input id="rc" type="number" min={0} className="field" value={cost} onChange={(e) => setCost(e.target.value)} />
                <p className="hint">Change it only if this batch cost a different amount. Margins use the new cost from now on.</p>
              </>
            )}
            <label className="label mt-4" htmlFor="rn">Note (supplier, invoice no.)</label>
            <input id="rn" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            <button
              disabled={pending || !(Number(qty) > 0)}
              onClick={() => run(() => receiveStock(row.id, Number(qty), margins && cost !== '' && Number(cost) !== row.cost ? Number(cost) : null, note), { onSuccess: close })}
              className="btn btn-primary mt-5 w-full"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Add {Number(qty) || ''} to stock
            </button>
          </>
        )}
      </Modal>

      <Modal open={mode?.kind === 'adjust'} onClose={close} title="Adjust stock">
        {row && (
          <>
            <p className="text-sm"><b>{row.name}</b> · {row.label || 'Standard'} <span className="text-muted">· {row.qty} in stock now</span></p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['remove', 'add'] as const).map((d) => (
                <button key={d} onClick={() => { setDirection(d); setReason(d === 'remove' ? 'damage' : 'correction') }} className={cn('rounded-xl border px-3 py-2.5 text-sm font-bold', direction === d ? 'border-ink bg-ink text-white' : 'border-line')}>
                  {d === 'remove' ? 'Remove items' : 'Add items'}
                </button>
              ))}
            </div>
            <label className="label mt-4" htmlFor="aq">How many?</label>
            <input id="aq" type="number" min={1} className="field text-lg" value={qty} onChange={(e) => setQty(e.target.value)} />
            <label className="label mt-4" htmlFor="ar">Reason</label>
            <select id="ar" className="field" value={reason} onChange={(e) => setReason(e.target.value as Enums<'stock_reason'>)}>
              {(direction === 'remove' ? ['damage', 'loss', 'correction'] : ['correction', 'return']).map((r) => <option key={r} value={r}>{STOCK_REASON_LABEL[r as Enums<'stock_reason'>]}</option>)}
            </select>
            <label className="label mt-4" htmlFor="an">Explain what happened</label>
            <textarea id="an" rows={2} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required — saved to the audit log" />
            <button
              disabled={pending || !(Number(qty) > 0) || note.trim().length < 3}
              onClick={() => run(() => adjustStock(row.id, direction === 'remove' ? -Number(qty) : Number(qty), reason, note), { onSuccess: close })}
              className="btn btn-primary mt-5 w-full"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Save adjustment
            </button>
          </>
        )}
      </Modal>

      <Modal open={mode?.kind === 'history'} onClose={close} title="Stock history" wide>
        {row && <p className="mb-4 text-sm"><b>{row.name}</b> · {row.label || 'Standard'} · {row.sku}</p>}
        {loadingHistory || !history ? (
          <Loader2 className="mx-auto size-6 animate-spin text-muted" />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">No movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>What</th><th className="text-right">Change</th><th className="text-right">After</th><th>By</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                    <td className="text-xs">
                      <b>{STOCK_REASON_LABEL[h.reason]}</b>
                      {h.orders?.order_number && <> · <Link href={`/dashboard/orders/${h.order_id}`} className="underline">{h.orders.order_number}</Link></>}
                      {h.note && <span className="block text-muted">{h.note}</span>}
                      {h.new_cost_price != null && margins && <span className="block text-muted">New cost {formatKes(h.new_cost_price)}</span>}
                    </td>
                    <td className={cn('text-right font-bold', h.quantity_delta > 0 ? 'text-success' : 'text-danger')}>{h.quantity_delta > 0 ? '+' : ''}{h.quantity_delta}</td>
                    <td className="text-right">{h.quantity_after}</td>
                    <td className="text-xs">{(h.profiles as { full_name: string | null } | null)?.full_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
