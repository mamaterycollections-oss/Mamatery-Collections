'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, Check, CreditCard, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatKes } from '@/lib/utils'
import { cancelMyOrder, payByCard, resendMpesa } from './actions'

type Props = {
  orderId: string
  token: string
  method: 'mpesa' | 'card'
  total: number
  phone: string
  email: string
  initialError: string | null
  paymentStatus: string
}

export function PaymentPanel({ orderId, token, method, total, phone: initialPhone, email, initialError, paymentStatus }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'waiting' | 'failed' | 'paid' | 'idle'>(initialError ? 'failed' : paymentStatus === 'pending' ? 'waiting' : 'idle')
  const [error, setError] = useState<string | null>(initialError)
  const [phone, setPhone] = useState(initialPhone.startsWith('+254') ? `0${initialPhone.slice(4)}` : initialPhone)
  const [pending, start] = useTransition()
  const started = useRef(Date.now())

  // Poll while the customer approves on their phone (up to ~3 minutes).
  useEffect(() => {
    if (state !== 'waiting' || method !== 'mpesa') return
    let stop = false
    const tick = async () => {
      if (stop) return
      const res = await fetch(`/api/orders/${orderId}/status?t=${token}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
      if (res?.payment_status === 'paid') {
        setState('paid')
        setTimeout(() => router.replace(`/orders/${orderId}?t=${token}&new=1`), 2200)
        return
      }
      if (res?.payment_status === 'failed') {
        setState('failed')
        setError('The payment was cancelled or didn’t go through. You can try again below.')
        return
      }
      if (Date.now() - started.current > 180_000) {
        setState('failed')
        setError('We didn’t hear back from M-Pesa. If you paid, it will show here shortly — otherwise try again.')
        return
      }
      setTimeout(tick, 3000)
    }
    const t = setTimeout(tick, 2500)
    return () => {
      stop = true
      clearTimeout(t)
    }
  }, [state, method, orderId, token, router])

  const resend = () =>
    start(async () => {
      const r = await resendMpesa(orderId, token, phone)
      if ('error' in r && r.error) {
        setError(r.error)
        setState('failed')
      } else {
        setError(null)
        started.current = Date.now()
        setState('waiting')
      }
    })

  const card = () =>
    start(async () => {
      const r = await payByCard(orderId, token, email)
      if ('url' in r && r.url) window.location.href = r.url
      else setError(r.error ?? 'Could not start card payment')
    })

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
      <AnimatePresence mode="wait">
        {state === 'paid' ? (
          <motion.div key="paid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center">
            <SuccessBurst />
            <p className="mt-4 font-display text-3xl">Payment received!</p>
            <p className="mt-1 text-muted">We&apos;re getting your order ready.</p>
          </motion.div>
        ) : state === 'waiting' && method === 'mpesa' ? (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5 p-8 text-center sm:flex-row sm:text-left">
            <div className="relative grid size-24 shrink-0 place-items-center">
              <motion.span className="absolute inset-0 rounded-full bg-[#4CAF50]/20" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity }} />
              <motion.div animate={{ rotate: [0, -8, 8, -8, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.4 }} className="grid size-16 place-items-center rounded-2xl bg-[#4CAF50] text-white">
                <Smartphone className="size-8" />
              </motion.div>
            </div>
            <div className="flex-1">
              <p className="font-display text-2xl">Check your phone</p>
              <p className="mt-1 text-muted">
                We sent an M-Pesa prompt for <b className="text-ink">{formatKes(total)}</b>. Enter your M-Pesa PIN to complete the order.
              </p>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted sm:justify-start"><Loader2 className="size-3.5 animate-spin" /> Waiting for confirmation…</p>
            </div>
            <button onClick={() => setState('failed')} className="text-xs font-bold underline">Didn&apos;t get it?</button>
          </motion.div>
        ) : (
          <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 sm:p-8">
            <p className="font-display text-2xl">Complete your payment</p>
            <p className="mt-1 text-sm text-muted">Your items are reserved for 45 minutes. Pay {formatKes(total)} to confirm your order.</p>
            {error && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>
            )}
            {method === 'mpesa' ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className="field sm:max-w-60" aria-label="M-Pesa phone number" placeholder="0712 345 678" />
                <button onClick={resend} disabled={pending} className="btn btn-primary">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Send M-Pesa prompt
                </button>
              </div>
            ) : (
              <button onClick={card} disabled={pending} className="btn btn-primary mt-5">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Pay by card
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SuccessBurst() {
  return (
    <div className="relative mx-auto grid size-20 place-items-center">
      {Array.from({ length: 12 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute size-2 rounded-full"
          style={{ background: ['#B4532A', '#C49A4A', '#2F6B45'][i % 3] }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos((i / 12) * Math.PI * 2) * 60, y: Math.sin((i / 12) * Math.PI * 2) * 60, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
      ))}
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} className="grid size-20 place-items-center rounded-full bg-success text-white">
        <Check className="size-10" strokeWidth={3} />
      </motion.span>
    </div>
  )
}

export function PaymentSuccess({ orderNumber, cod }: { orderNumber: string; cod: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center gap-5 rounded-3xl bg-success-soft p-8 text-center sm:flex-row sm:text-left">
      <SuccessBurst />
      <div>
        <p className="font-display text-2xl">Order {orderNumber} confirmed</p>
        <p className="mt-1 text-sm text-success">
          {cod ? 'Pay the rider in cash when your order arrives.' : 'Payment received.'} We&apos;ll send SMS updates as your order moves.
        </p>
      </div>
    </motion.div>
  )
}

export function CancelOrder({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('Cancel this order?')) return
        start(async () => {
          const r = await cancelMyOrder(orderId)
          if ('error' in r && r.error) toast.error(r.error)
          else {
            toast.success('Order cancelled')
            router.refresh()
          }
        })
      }}
      className="btn btn-ghost text-danger"
    >
      {pending && <Loader2 className="size-4 animate-spin" />} Cancel order
    </button>
  )
}
