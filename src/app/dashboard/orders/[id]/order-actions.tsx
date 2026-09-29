'use client'

import { useState } from 'react'
import { ArrowRight, Ban, BadgePercent, Banknote, Loader2, RotateCcw, Smartphone, Undo2 } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { useAction } from '@/components/dash/use-action'
import type { Enums } from '@/lib/supabase/database.types'
import { formatKes, ORDER_STATUS_LABEL } from '@/lib/utils'
import { applyDiscount, markOrderPaid, refundOrder, sendMpesaPrompt, updateOrderStatus } from '../actions'

type Order = {
  id: string
  status: Enums<'order_status'>
  channel: Enums<'order_channel'>
  delivery_method: Enums<'delivery_method'>
  payment_status: Enums<'payment_status'>
  payment_method: Enums<'payment_method'>
  subtotal: number
  discount_total: number
  contact_phone: string | null
}

const NEXT: Partial<Record<Enums<'order_status'>, (o: Order) => Enums<'order_status'> | null>> = {
  placed: () => 'confirmed',
  confirmed: () => 'packed',
  packed: (o) => (o.delivery_method === 'courier' ? 'out_for_delivery' : 'ready_for_pickup'),
  out_for_delivery: () => 'delivered',
  ready_for_pickup: () => 'collected',
}
const NEXT_LABEL: Partial<Record<Enums<'order_status'>, string>> = {
  confirmed: 'Confirm order',
  packed: 'Mark as packed',
  out_for_delivery: 'Hand to rider',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Mark delivered',
  collected: 'Mark collected',
}

export function OrderActions({ order, discountLimit }: { order: Order; discountLimit: number }) {
  const { pending, run } = useAction()
  const [dialog, setDialog] = useState<null | 'cancel' | 'return' | 'paid' | 'refund' | 'discount' | 'mpesa'>(null)
  const [text, setText] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<Enums<'payment_method'>>('mpesa')
  const close = () => {
    setDialog(null)
    setText('')
    setAmount('')
  }

  const next = NEXT[order.status]?.(order) ?? null
  const needsPayment = order.payment_status !== 'paid' && !['cancelled', 'returned'].includes(order.status)
  const blockedByPayment = next === 'confirmed' && ['mpesa', 'card'].includes(order.payment_method) && order.payment_status !== 'paid'
  const canCancel = order.channel === 'online' ? ['placed', 'confirmed', 'packed', 'out_for_delivery', 'ready_for_pickup'].includes(order.status) : order.status === 'collected'
  const canReturn = ['delivered', 'collected', 'out_for_delivery'].includes(order.status)
  const refundDue = ['cancelled', 'returned'].includes(order.status) && order.payment_status === 'paid'
  const maxDiscount = Math.floor((order.subtotal * discountLimit) / 100)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        {next && order.channel === 'online' && (
          <button disabled={pending || blockedByPayment} onClick={() => run(() => updateOrderStatus(order.id, next), { success: `Order ${ORDER_STATUS_LABEL[next].toLowerCase()}` })} className="btn btn-primary">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} {NEXT_LABEL[next]}
          </button>
        )}
        {needsPayment && (
          <button onClick={() => setDialog('paid')} className="btn btn-light"><Banknote className="size-4" /> Record payment</button>
        )}
        {needsPayment && order.contact_phone && order.payment_method === 'mpesa' && (
          <button onClick={() => { setText(order.contact_phone ?? ''); setDialog('mpesa') }} className="btn btn-light"><Smartphone className="size-4" /> Send M-Pesa prompt</button>
        )}
        {needsPayment && order.channel === 'online' && discountLimit > 0 && (
          <button onClick={() => setDialog('discount')} className="btn btn-light"><BadgePercent className="size-4" /> Discount</button>
        )}
        {refundDue && <button onClick={() => setDialog('refund')} className="btn btn-accent"><Undo2 className="size-4" /> Record refund</button>}
        <span className="flex-1" />
        {canReturn && <button onClick={() => setDialog('return')} className="btn btn-ghost btn-sm"><RotateCcw className="size-4" /> Return</button>}
        {canCancel && <button onClick={() => setDialog('cancel')} className="btn btn-ghost btn-sm text-danger"><Ban className="size-4" /> {order.channel === 'in_store' ? 'Void sale' : 'Cancel'}</button>}
      </div>
      {blockedByPayment && <p className="mt-3 text-xs text-warning">Waiting for the customer&apos;s {order.payment_method === 'mpesa' ? 'M-Pesa' : 'card'} payment before this order can be confirmed.</p>}
      {!next && !needsPayment && !refundDue && <p className="mt-1 text-sm text-muted">No further steps for this order.</p>}

      <Modal open={dialog === 'cancel' || dialog === 'return'} onClose={close} title={dialog === 'return' ? 'Return order' : order.channel === 'in_store' ? 'Void this sale' : 'Cancel order'}>
        <p className="text-sm text-muted">Items go back into stock. The reason is recorded in the audit log{dialog === 'cancel' && order.channel === 'online' ? ' and sent to the customer' : ''}.</p>
        {order.payment_status === 'paid' && <p className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">This order was paid ({formatKes(order.subtotal - order.discount_total)}+). Remember to refund the customer, then record the refund.</p>}
        <label className="label mt-4" htmlFor="reason">Reason</label>
        <textarea id="reason" rows={3} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={dialog === 'return' ? 'e.g. Wrong size, unworn with tags' : 'e.g. Customer changed their mind'} />
        <button disabled={pending || text.trim().length < 3} onClick={() => run(() => updateOrderStatus(order.id, dialog === 'return' ? 'returned' : 'cancelled', text), { success: 'Done', onSuccess: close })} className="btn btn-danger mt-4 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />} Confirm
        </button>
      </Modal>

      <Modal open={dialog === 'paid'} onClose={close} title="Record a payment">
        <p className="text-sm text-muted">Use this when money arrived outside the automatic flow — e.g. the customer paid to the till number, or the rider collected cash.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(['mpesa', 'cash', 'card'] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${method === m ? 'border-ink bg-ink text-white' : 'border-line'}`}>
              {m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Card'}
            </button>
          ))}
        </div>
        <label className="label mt-4" htmlFor="ref">{method === 'mpesa' ? 'M-Pesa confirmation code' : 'Reference (optional)'}</label>
        <input id="ref" className="field uppercase" value={text} onChange={(e) => setText(e.target.value.toUpperCase())} placeholder={method === 'mpesa' ? 'e.g. SJK4XXXXXX' : ''} />
        <button disabled={pending || (method === 'mpesa' && text.trim().length < 8)} onClick={() => run(() => markOrderPaid(order.id, method, text), { success: 'Payment recorded', onSuccess: close })} className="btn btn-primary mt-4 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />} Mark as paid
        </button>
      </Modal>

      <Modal open={dialog === 'mpesa'} onClose={close} title="Send M-Pesa prompt">
        <label className="label" htmlFor="mp">Customer phone</label>
        <input id="mp" className="field" type="tel" value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={pending} onClick={() => run(() => sendMpesaPrompt(order.id, text), { onSuccess: close })} className="btn btn-primary mt-4 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />} Send prompt
        </button>
      </Modal>

      <Modal open={dialog === 'refund'} onClose={close} title="Record refund">
        <p className="text-sm text-muted">Record that the customer has been refunded (e.g. M-Pesa reversal or cash returned).</p>
        <label className="label mt-4" htmlFor="rr">How was it refunded?</label>
        <textarea id="rr" rows={3} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Sent back via M-Pesa, code SJK…" />
        <button disabled={pending || text.trim().length < 3} onClick={() => run(() => refundOrder(order.id, text), { success: 'Refund recorded', onSuccess: close })} className="btn btn-primary mt-4 w-full">Record refund</button>
      </Modal>

      <Modal open={dialog === 'discount'} onClose={close} title="Apply a discount">
        <p className="text-sm text-muted">Your limit: {discountLimit}% of the subtotal (up to {formatKes(maxDiscount)}).</p>
        <label className="label mt-4" htmlFor="amt">Discount amount (KES)</label>
        <input id="amt" type="number" min={0} max={maxDiscount} className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="label mt-4" htmlFor="dr">Reason</label>
        <input id="dr" className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Loyal customer, agreed on phone" />
        <button disabled={pending || !amount || Number(amount) > maxDiscount || text.trim().length < 3} onClick={() => run(() => applyDiscount(order.id, Number(amount), text), { success: 'Discount applied', onSuccess: close })} className="btn btn-primary mt-4 w-full">Apply discount</button>
      </Modal>
    </div>
  )
}
