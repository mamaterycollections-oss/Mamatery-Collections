'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Banknote, Check, CreditCard, Loader2, Minus, Plus, Printer, ScanBarcode, Search, Smartphone, Trash2, Wallet, X } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { beep, CameraScanner } from '@/components/dash/scanner'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { cn, formatKes } from '@/lib/utils'
import { checkSalePayment, openDrawer, recordSale } from './actions'

type Item = { variantId: string; name: string; label: string; sku: string; image: string | null; price: number; stock: number; qty: number }
type Pay = 'cash' | 'mpesa' | 'card'
type Done = { id: string; number: string; total: number; change: number | null; status: 'paid' | 'waiting' | 'failed'; message?: string }

const VARIANT_FIELDS = 'id, sku, barcode_value, size, colour, selling_price, quantity_on_hand, image_url, is_active, products!inner(name, images, is_active)'

export function PosTerminal({ drawer, discountLimit, cashier }: { drawer: { id: string; float: number; taken: number; openedAt: string } | null; discountLimit: number; cashier: string }) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [code, setCode] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [looking, setLooking] = useState(false)
  const [pay, setPay] = useState<Pay>('cash')
  const [tendered, setTendered] = useState('')
  const [reference, setReference] = useState('')
  const [stk, setStk] = useState(false)
  const [discount, setDiscount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [drawerModal, setDrawerModal] = useState(false)
  const [float, setFloat] = useState('')
  const [pending, start] = useTransition()
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - disc
  const maxDiscount = Math.floor((subtotal * discountLimit) / 100)
  const change = pay === 'cash' && tendered ? Number(tendered) - total : null

  const toItem = (v: { id: string; sku: string; size: string | null; colour: string | null; selling_price: number; quantity_on_hand: number; image_url: string | null; products: { name: string; images: string[] } }): Item => ({
    variantId: v.id, name: v.products.name, label: [v.size, v.colour].filter(Boolean).join(' / '), sku: v.sku,
    image: v.image_url ?? v.products.images[0] ?? null, price: Number(v.selling_price), stock: v.quantity_on_hand, qty: 1,
  })

  const add = useCallback((it: Item) => {
    if (it.stock <= 0) {
      beep(false)
      toast.error(`${it.name} ${it.label} is out of stock`, 'Check the shelf count — stock may need correcting.')
      return
    }
    setItems((list) => {
      const existing = list.find((x) => x.variantId === it.variantId)
      if (existing) {
        if (existing.qty >= it.stock) {
          beep(false)
          toast.error(`Only ${it.stock} in stock`)
          return list
        }
        return list.map((x) => (x.variantId === it.variantId ? { ...x, qty: x.qty + 1 } : x))
      }
      return [{ ...it, qty: 1 }, ...list]
    })
    setLastAdded(it.variantId)
    beep(true)
  }, [toast])

  // Exact barcode / SKU lookup (scanner or Enter)
  const lookup = useCallback(async (raw: string) => {
    const value = raw.trim()
    if (!value) return
    setLooking(true)
    const supabase = createClient()
    const { data } = await supabase.from('product_variants').select(VARIANT_FIELDS).or(`barcode_value.eq.${value.replace(/[^0-9A-Za-z-]/g, '')},sku.ilike.${value.replace(/[^0-9A-Za-z-]/g, '')}`).eq('is_active', true).limit(1).maybeSingle()
    setLooking(false)
    if (!data) {
      beep(false)
      toast.error('No product with that barcode', value)
      return
    }
    add(toItem(data as never))
    setCode('')
    setResults([])
  }, [add, toast])

  // Name search while typing
  useEffect(() => {
    const term = code.trim()
    if (term.length < 2 || /^\d{8,}$/.test(term)) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await createClient().from('product_variants').select(VARIANT_FIELDS).eq('is_active', true).ilike('products.name', `%${term.replace(/[%,()]/g, '')}%`).limit(12)
      setResults((data ?? []).map((v) => toItem(v as never)))
    }, 200)
    return () => clearTimeout(t)
  }, [code])

  // Keep the scan box focused so a USB/Bluetooth scanner "just works".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (done || target.closest('input,textarea,select,[role=dialog]')) return
      if (/^[0-9A-Za-z]$/.test(e.key)) input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done])

  const setQty = (id: string, qty: number) => setItems((list) => list.flatMap((x) => (x.variantId !== id ? [x] : qty <= 0 ? [] : [{ ...x, qty: Math.min(qty, x.stock) }])))

  const reset = () => {
    setItems([]); setTendered(''); setReference(''); setStk(false); setDiscount(''); setDiscountReason(''); setCustomerName(''); setCustomerPhone(''); setDone(null)
    setTimeout(() => input.current?.focus(), 50)
  }

  const charge = () => {
    if (!items.length) return
    if (pay === 'cash' && !drawer) return setDrawerModal(true)
    if (disc > maxDiscount) return toast.error(`Your discount limit is ${discountLimit}% (${formatKes(maxDiscount)})`)
    if (disc > 0 && discountReason.trim().length < 3) return toast.error('Give a reason for the discount')
    if (pay === 'cash' && tendered && Number(tendered) < total) return toast.error('Cash received is less than the total')
    if (pay === 'mpesa' && !stk && reference.trim().length < 8) return toast.error('Enter the M-Pesa confirmation code from the customer’s SMS')
    start(async () => {
      const r = await recordSale({
        items: items.map((i) => ({ variant_id: i.variantId, quantity: i.qty })), payment: pay, discount: disc, discountReason,
        reference: pay === 'cash' ? '' : reference, tendered: pay === 'cash' && tendered ? Number(tendered) : null,
        customerName, customerPhone, stk: pay === 'mpesa' && stk,
      })
      if (!('ok' in r) || !r.ok) {
        beep(false)
        toast.error('error' in r ? r.error : 'Sale failed')
        return
      }
      const s = r.data!
      setDone({ id: s.id, number: s.order_number, total: s.total, change: s.change, status: s.payment_status === 'paid' ? 'paid' : 'waiting', message: s.stkMessage })
      beep(true)
      router.refresh()
    })
  }

  // Waiting for an in-store STK push
  useEffect(() => {
    if (done?.status !== 'waiting') return
    let stop = false
    const started = Date.now()
    const tick = async () => {
      if (stop) return
      const r = await checkSalePayment(done.id)
      if ('ok' in r && r.ok && r.data?.payment_status === 'paid') {
        beep(true)
        setDone((d) => (d ? { ...d, status: 'paid' } : d))
        return
      }
      if ('ok' in r && r.ok && r.data?.payment_status === 'failed') return setDone((d) => (d ? { ...d, status: 'failed' } : d))
      if (Date.now() - started > 150_000) return setDone((d) => (d ? { ...d, status: 'failed', message: 'No confirmation yet. Record the payment on the order once it arrives.' } : d))
      setTimeout(tick, 3000)
    }
    const t = setTimeout(tick, 3000)
    return () => {
      stop = true
      clearTimeout(t)
    }
  }, [done?.status, done?.id])

  const quick = useMemo(() => {
    const opts = new Set<number>([total])
    for (const step of [100, 500, 1000]) opts.add(Math.ceil(total / step) * step)
    return [...opts].filter((n) => n >= total).sort((a, b) => a - b).slice(0, 4)
  }, [total])

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100dvh-3.5rem)] sm:-mx-6 lg:-mx-8 lg:-my-8 lg:grid-cols-[1fr_25rem]">
      {/* Left: scan + cart */}
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl">Quick sale</h1>
          <button onClick={() => (drawer ? router.push('/dashboard/cash') : setDrawerModal(true))} className={cn('chip px-3 py-2 text-xs', drawer ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
            <Wallet className="size-3.5" /> {drawer ? `Drawer open · ${formatKes(drawer.float + drawer.taken)} expected` : 'Cash drawer closed — tap to open'}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <CameraScanner onScan={lookup} className="aspect-[4/3] md:aspect-auto md:h-full" />
          <div className="relative">
            <form onSubmit={(e) => { e.preventDefault(); lookup(code) }} className="relative">
              <ScanBarcode className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
              <input
                ref={input}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan barcode, type SKU or search name…"
                className="field h-14 rounded-2xl pr-12 pl-12 text-base"
                inputMode="search"
                aria-label="Scan or search"
              />
              {looking ? <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-muted" /> : <Search className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted" />}
            </form>
            <AnimatePresence>
              {results.length > 0 && (
                <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-16 z-20 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white p-1 shadow-lift">
                  {results.map((r) => (
                    <li key={r.variantId}>
                      <button onClick={() => { add(r); setCode(''); setResults([]) }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sand">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-sand">{r.image && <Image src={r.image} alt="" fill sizes="40px" className="object-cover" />}</div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{r.name}</span>
                          <span className="block text-xs text-muted">{r.label} · {r.stock} in stock</span>
                        </span>
                        <span className="text-sm font-bold">{formatKes(r.price)}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
            <p className="mt-2 text-xs text-muted">Tip: a USB or Bluetooth barcode scanner types straight into this box.</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-2xl border border-line bg-white">
          {items.length === 0 ? (
            <div className="grid h-full min-h-48 place-items-center p-8 text-center text-muted">
              <div>
                <ScanBarcode className="mx-auto size-10" />
                <p className="mt-3 font-bold text-ink">Scan an item to start a sale</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {items.map((i) => (
                  <motion.li
                    key={i.variantId}
                    layout
                    initial={{ opacity: 0, backgroundColor: '#e3f0e6' }}
                    animate={{ opacity: 1, backgroundColor: lastAdded === i.variantId ? ['#e3f0e6', '#ffffff'] : '#ffffff' }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ duration: 0.6 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sand">{i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{i.name}</p>
                      <p className="text-xs text-muted">{i.label} · {i.sku} · {formatKes(i.price)}</p>
                    </div>
                    <div className="flex items-center rounded-full border border-line">
                      <button onClick={() => setQty(i.variantId, i.qty - 1)} className="grid size-11 place-items-center" aria-label="Less"><Minus className="size-4" /></button>
                      <span className="w-6 text-center font-bold tabular-nums">{i.qty}</span>
                      <button onClick={() => setQty(i.variantId, i.qty + 1)} disabled={i.qty >= i.stock} className="grid size-11 place-items-center disabled:opacity-30" aria-label="More"><Plus className="size-4" /></button>
                    </div>
                    <p className="w-24 text-right font-bold tabular-nums">{formatKes(i.price * i.qty)}</p>
                    <button onClick={() => setQty(i.variantId, 0)} className="grid size-10 place-items-center text-muted hover:text-danger" aria-label="Remove"><Trash2 className="size-4" /></button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      {/* Right: payment */}
      <aside className="flex flex-col border-t border-line bg-white p-4 sm:p-6 lg:border-t-0 lg:border-l">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Items</span><span className="font-semibold">{items.reduce((s, i) => s + i.qty, 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-semibold tabular-nums">{formatKes(subtotal)}</span></div>
          {discountLimit > 0 && (
            <div className="rounded-xl bg-paper p-3">
              <div className="flex items-center gap-2">
                <span className="text-muted">Discount</span>
                <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" min={0} max={maxDiscount} className="field field-sm ml-auto w-28 text-right" placeholder="0" aria-label="Discount amount" />
              </div>
              {disc > 0 && <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="field field-sm mt-2" placeholder="Reason (required)" aria-label="Discount reason" />}
              <p className={cn('mt-1 text-[0.7rem]', disc > maxDiscount ? 'text-danger' : 'text-muted')}>Max {discountLimit}% · {formatKes(maxDiscount)}</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
          <span className="font-bold">Total</span>
          <motion.span key={total} initial={{ scale: 1.08 }} animate={{ scale: 1 }} className="font-display text-4xl tabular-nums">{formatKes(total)}</motion.span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
          {([['cash', 'Cash', Banknote], ['mpesa', 'M-Pesa', Smartphone], ['card', 'Card', CreditCard]] as const).map(([k, label, Icon]) => (
            <button key={k} role="radio" aria-checked={pay === k} onClick={() => setPay(k)} className={cn('flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-bold transition', pay === k ? 'border-ink bg-ink text-white' : 'border-line hover:border-stone')}>
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {pay === 'cash' && (
            <>
              <label className="label" htmlFor="tendered">Cash received</label>
              <input id="tendered" value={tendered} onChange={(e) => setTendered(e.target.value)} type="number" inputMode="numeric" className="field text-lg" placeholder={String(total)} />
              <div className="flex flex-wrap gap-2">
                {quick.map((n) => <button key={n} onClick={() => setTendered(String(n))} className="btn btn-light btn-sm">{formatKes(n)}</button>)}
              </div>
              {change != null && change >= 0 && <p className="rounded-xl bg-success-soft p-3 text-center font-bold text-success">Change: {formatKes(change)}</p>}
            </>
          )}
          {pay === 'mpesa' && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button onClick={() => setStk(false)} className={cn('rounded-xl border px-2 py-2', !stk ? 'border-ink bg-sand' : 'border-line')}>Customer paid to till</button>
                <button onClick={() => setStk(true)} className={cn('rounded-xl border px-2 py-2', stk ? 'border-ink bg-sand' : 'border-line')}>Send prompt to phone</button>
              </div>
              {stk ? (
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" className="field" placeholder="Customer M-Pesa number" aria-label="Customer M-Pesa number" />
              ) : (
                <input value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} className="field font-mono uppercase" placeholder="M-Pesa code, e.g. SJK4XXXXXX" aria-label="M-Pesa confirmation code" />
              )}
            </>
          )}
          {pay === 'card' && <input value={reference} onChange={(e) => setReference(e.target.value)} className="field" placeholder="Card slip reference (optional)" aria-label="Card reference" />}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-bold text-muted">Add customer details (optional)</summary>
            <div className="mt-2 grid gap-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="field field-sm" placeholder="Name" />
              {!(pay === 'mpesa' && stk) && <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="field field-sm" type="tel" placeholder="Phone" />}
            </div>
          </details>
        </div>

        <div className="mt-auto pt-5">
          <button onClick={charge} disabled={!items.length || pending} className="btn btn-accent h-16 w-full text-lg">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Charge {formatKes(total)}
          </button>
          {items.length > 0 && <button onClick={reset} className="btn btn-ghost mt-2 w-full text-muted"><X className="size-4" /> Clear sale</button>}
          <p className="mt-2 text-center text-[0.7rem] text-muted">Cashier: {cashier}</p>
        </div>
      </aside>

      {/* Sale complete */}
      <AnimatePresence>
        {done && (
          <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-8 text-center" role="dialog" aria-label="Sale complete">
              {done.status === 'waiting' ? (
                <>
                  <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#4CAF50]/15"><Smartphone className="size-9 animate-pulse text-[#2e7d32]" /></div>
                  <p className="mt-4 font-display text-2xl">Waiting for M-Pesa…</p>
                  <p className="mt-1 text-sm text-muted">{done.message ?? 'Ask the customer to enter their PIN.'}</p>
                  <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted" />
                </>
              ) : done.status === 'failed' ? (
                <>
                  <div className="mx-auto grid size-20 place-items-center rounded-full bg-danger-soft"><X className="size-9 text-danger" /></div>
                  <p className="mt-4 font-display text-2xl">Payment not confirmed</p>
                  <p className="mt-1 text-sm text-muted">{done.message ?? 'The customer cancelled or the prompt timed out.'} Sale {done.number} is saved as unpaid — record payment on the order or void it.</p>
                  <a href={`/dashboard/orders/${done.id}`} className="btn btn-light mt-5 w-full">Open order</a>
                </>
              ) : (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} className="mx-auto grid size-20 place-items-center rounded-full bg-success text-white"><Check className="size-10" strokeWidth={3} /></motion.div>
                  <p className="mt-4 font-display text-2xl">Sale complete</p>
                  <p className="text-sm text-muted">{done.number} · {formatKes(done.total)}</p>
                  {done.change != null && done.change > 0 && <p className="mt-4 rounded-2xl bg-success-soft p-4 text-success"><span className="block text-xs font-bold uppercase">Give change</span><span className="font-display text-4xl">{formatKes(done.change)}</span></p>}
                  <a href={`/receipt/${done.id}?format=thermal`} target="_blank" className="btn btn-light mt-5 w-full"><Printer className="size-4" /> Print receipt</a>
                </>
              )}
              <button onClick={reset} className="btn btn-primary btn-lg mt-2 w-full" autoFocus>New sale</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={drawerModal} onClose={() => setDrawerModal(false)} title="Open cash drawer">
        <p className="text-sm text-muted">Count the cash in the drawer before your first sale. At the end of your shift you&apos;ll count it again — any difference is reported to the owner.</p>
        <label className="label mt-4" htmlFor="float">Opening cash (float)</label>
        <input id="float" type="number" min={0} className="field text-lg" value={float} onChange={(e) => setFloat(e.target.value)} placeholder="e.g. 2000" autoFocus />
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await openDrawer(Number(float) || 0)
            if ('ok' in r && r.ok) { toast.success('Drawer open — ready to sell'); setDrawerModal(false); router.refresh() } else toast.error('error' in r ? r.error : 'Failed')
          })}
          className="btn btn-primary mt-4 w-full"
        >
          Open drawer
        </button>
      </Modal>
    </div>
  )
}
