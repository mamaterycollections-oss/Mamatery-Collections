'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, Banknote, Check, ChevronDown, CreditCard, Loader2, Lock, MapPin, Smartphone, Store, Tag, Truck, X } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { useToast } from '@/components/ui/toast'
import { cn, formatKes } from '@/lib/utils'
import { placeOrder, previewCoupon, refreshCart } from './actions'

type Zone = { id: string; name: string; description: string | null; fee: number; eta: string | null; cod: boolean }
type Address = { id: string; recipient_name: string; phone: string; zone_id: string | null; address_line: string; landmark: string | null; is_default: boolean }
type Props = {
  zones: Zone[]
  settings: { pickup: { address: string | null; hours: string | null } | null; mpesa: boolean; card: boolean; cod: boolean; freeOver: number | null }
  user: { name: string; phone: string; email: string; signedIn: boolean } | null
  addresses: Address[]
}

export function CheckoutForm({ zones, settings, user, addresses }: Props) {
  const router = useRouter()
  const toast = useToast()
  const cart = useCart()
  const [pending, start] = useTransition()
  const def = addresses.find((a) => a.is_default) ?? addresses[0]

  const [name, setName] = useState(def?.recipient_name ?? user?.name ?? '')
  const [phone, setPhone] = useState(def?.phone ?? user?.phone ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [method, setMethod] = useState<'courier' | 'pickup'>('courier')
  const [zone, setZone] = useState<string>(def?.zone_id ?? '')
  const [address, setAddress] = useState(def?.address_line ?? '')
  const [notes, setNotes] = useState(def?.landmark ?? '')
  const [saveAddress, setSaveAddress] = useState(!addresses.length)
  const [payment, setPayment] = useState<'mpesa' | 'card' | 'cod'>(settings.mpesa ? 'mpesa' : settings.card ? 'card' : 'cod')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [checked, setChecked] = useState(false)

  // Re-price the bag against live stock and prices.
  useEffect(() => {
    if (!cart.lines.length || checked) return
    setChecked(true)
    refreshCart(cart.lines.map((l) => l.variantId)).then((fresh) => {
      let changed = false
      const next = cart.lines.flatMap((l) => {
        const f = fresh.find((x) => x.id === l.variantId)
        if (!f || f.available <= 0) {
          changed = true
          return []
        }
        const quantity = Math.min(l.quantity, f.available)
        if (quantity !== l.quantity || f.price !== l.price) changed = true
        return [{ ...l, price: f.price, maxQty: f.available, quantity }]
      })
      if (changed) {
        cart.replace(next)
        toast.toast({ tone: 'info', title: 'Your bag was updated', body: 'Some prices or stock levels changed since you added items.' })
      }
    })
  }, [cart, checked, toast])

  const selectedZone = zones.find((z) => z.id === zone)
  const discount = coupon?.discount ?? 0
  const freeDelivery = settings.freeOver != null && cart.subtotal - discount >= settings.freeOver
  const deliveryFee = method === 'pickup' ? 0 : freeDelivery ? 0 : (selectedZone?.fee ?? 0)
  const total = Math.max(0, cart.subtotal - discount) + deliveryFee
  const codAvailable = settings.cod && method === 'courier' && Boolean(selectedZone?.cod)

  useEffect(() => {
    if (payment === 'cod' && !codAvailable) setPayment(settings.mpesa ? 'mpesa' : 'card')
  }, [payment, codAvailable, settings.mpesa])
  // Coupon amounts depend on the subtotal; drop it if the bag changes.
  useEffect(() => setCoupon(null), [cart.subtotal])

  const applyCoupon = async () => {
    setCouponError(null)
    const res = await previewCoupon(couponInput, cart.subtotal)
    if ('error' in res) setCouponError(res.error ?? 'Invalid code')
    else {
      setCoupon({ code: res.code, discount: res.discount })
      toast.success(`${res.code} applied`, `You save ${formatKes(res.discount)}`)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await placeOrder({
        items: cart.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        name, phone, email, method,
        zone: method === 'courier' ? zone : undefined,
        address, notes, payment,
        mpesaPhone: mpesaPhone || phone,
        coupon: coupon?.code,
        saveAddress: user?.signedIn ? saveAddress : false,
      })
      if ('error' in res) {
        setError({ message: res.error, field: res.field })
        if (res.field) document.getElementById(`co-${res.field}`)?.focus()
        return
      }
      cart.clear()
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      const q = new URLSearchParams({ t: res.token, new: '1' })
      if (res.paymentError) q.set('perr', res.paymentError)
      router.push(`/orders/${res.orderId}?${q}`)
    })
  }

  if (!cart.lines.length && !pending) {
    return (
      <div className="container-page grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-display text-4xl">Your bag is empty</h1>
          <p className="mt-3 text-muted">Add something you love, then come back to check out.</p>
          <Link href="/shop" className="btn btn-primary btn-lg mt-8">Continue shopping</Link>
        </div>
      </div>
    )
  }

  const fieldErr = (f: string) => (error?.field === f ? error.message : null)

  const summary = (
    <div className="space-y-4">
      <ul className="space-y-4">
        {cart.lines.map((l) => (
          <li key={l.variantId} className="flex gap-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
              {l.image && <Image src={l.image} alt="" fill sizes="64px" className="object-cover" />}
              <span className="absolute -top-0 -right-0 grid size-5 place-items-center rounded-bl-lg bg-ink text-[0.65rem] font-bold text-white">{l.quantity}</span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="line-clamp-2 font-semibold">{l.name}</p>
              <p className="text-xs text-muted">{l.variantLabel}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{formatKes(l.price * l.quantity)}</p>
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-4">
        {coupon ? (
          <div className="flex items-center justify-between rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
            <span className="flex items-center gap-2 font-bold"><Tag className="size-4" /> {coupon.code}</span>
            <button type="button" onClick={() => setCoupon(null)} aria-label="Remove code"><X className="size-4" /></button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Discount code" className="field field-sm uppercase" aria-label="Discount code" />
              <button type="button" onClick={applyCoupon} disabled={!couponInput} className="btn btn-light btn-sm">Apply</button>
            </div>
            {couponError && <p className="mt-1.5 text-xs text-danger">{couponError}</p>}
          </div>
        )}
      </div>
      <dl className="space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatKes(cart.subtotal)}</dd></div>
        {discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd className="tabular-nums">−{formatKes(discount)}</dd></div>}
        <div className="flex justify-between">
          <dt className="text-muted">{method === 'pickup' ? 'Pickup' : 'Delivery'}</dt>
          <dd className="tabular-nums">{method === 'pickup' || freeDelivery ? 'Free' : selectedZone ? formatKes(deliveryFee) : 'Choose area'}</dd>
        </div>
        <div className="flex items-end justify-between border-t border-line pt-3">
          <dt className="font-bold">Total</dt>
          <dd><motion.span key={total} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block font-display text-3xl tabular-nums">{formatKes(total)}</motion.span></dd>
        </div>
      </dl>
    </div>
  )

  return (
    <div className="container-page pt-6 pb-32 sm:pt-10 lg:pb-10">
      <h1 className="font-display text-4xl sm:text-5xl">Checkout</h1>
      {!user && (
        <p className="mt-2 text-sm text-muted">
          Checking out as a guest. <Link href="/login?next=/checkout" className="font-bold text-ink underline">Sign in</Link> to use saved details.
        </p>
      )}

      {/* Mobile summary toggle */}
      <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="mt-6 flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 lg:hidden" aria-expanded={summaryOpen}>
        <span className="flex items-center gap-2 text-sm font-bold">{summaryOpen ? 'Hide' : 'Show'} order summary <ChevronDown className={cn('size-4 transition', summaryOpen && 'rotate-180')} /></span>
        <span className="font-bold tabular-nums">{formatKes(total)}</span>
      </button>
      <AnimatePresence initial={false}>
        {summaryOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden lg:hidden">
            <div className="mt-3 rounded-2xl border border-line bg-white p-4">{summary}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_27rem]">
        <div className="space-y-10">
          <Section step={1} title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="co-name" label="Full name" value={name} onChange={setName} autoComplete="name" error={fieldErr('name')} required />
              <Input id="co-phone" label="Phone number" value={phone} onChange={setPhone} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" error={fieldErr('phone')} required hint="For delivery updates by SMS" />
              <Input id="co-email" label="Email (optional)" value={email} onChange={setEmail} type="email" autoComplete="email" error={fieldErr('email')} className="sm:col-span-2" hint="We'll send your receipt here" />
            </div>
          </Section>

          <Section step={2} title="Delivery">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice active={method === 'courier'} onClick={() => setMethod('courier')} Icon={Truck} title="Deliver to me" body="Courier or boda to your door" />
              {settings.pickup && <Choice active={method === 'pickup'} onClick={() => setMethod('pickup')} Icon={Store} title="Pick up" body="Free · collect from our shop" />}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {method === 'courier' ? (
                <motion.div key="courier" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
                  {addresses.length > 0 && (
                    <div>
                      <p className="label">Saved addresses</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {addresses.map((a) => (
                          <button type="button" key={a.id} onClick={() => { setName(a.recipient_name); setPhone(a.phone); setZone(a.zone_id ?? ''); setAddress(a.address_line); setNotes(a.landmark ?? '') }} className={cn('shrink-0 rounded-xl border px-3 py-2 text-left text-xs', address === a.address_line ? 'border-ink bg-white' : 'border-line bg-white/60')}>
                            <span className="flex items-center gap-1 font-bold"><MapPin className="size-3" /> {a.recipient_name}</span>
                            <span className="line-clamp-1 max-w-48 text-muted">{a.address_line}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="label" id="co-zone-label">Delivery area</p>
                    <div className="grid gap-2" role="radiogroup" aria-labelledby="co-zone-label" id="co-zone" tabIndex={-1}>
                      {zones.map((z) => (
                        <button type="button" role="radio" aria-checked={zone === z.id} key={z.id} onClick={() => setZone(z.id)} className={cn('flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 text-left transition', zone === z.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-stone')}>
                          <span className="flex items-start gap-3">
                            <span className={cn('mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2', zone === z.id ? 'border-ink' : 'border-stone')}>{zone === z.id && <span className="size-2 rounded-full bg-ink" />}</span>
                            <span>
                              <span className="block text-sm font-bold">{z.name}</span>
                              {z.description && <span className="block text-xs text-muted">{z.description}</span>}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-sm">
                            <span className="block font-bold tabular-nums">{freeDelivery ? 'Free' : formatKes(z.fee)}</span>
                            {z.eta && <span className="block text-xs text-muted">{z.eta}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                    {fieldErr('zone') && <p className="mt-1.5 text-xs text-danger">{fieldErr('zone')}</p>}
                  </div>
                  <Input id="co-address" label="Delivery address" value={address} onChange={setAddress} autoComplete="street-address" placeholder="Estate, street, building, house no." error={fieldErr('address')} required />
                  <Input id="co-notes" label="Landmark / notes for the rider (optional)" value={notes} onChange={setNotes} placeholder="e.g. Opposite Naivas, blue gate" />
                  {user?.signedIn && (
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" className="size-4 accent-ink" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address for next time
                    </label>
                  )}
                </motion.div>
              ) : (
                <motion.div key="pickup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-2xl bg-sand p-4 text-sm">
                  <p className="flex items-center gap-2 font-bold"><Store className="size-4" /> Pickup location</p>
                  <p className="mt-1 text-muted">{settings.pickup?.address}</p>
                  {settings.pickup?.hours && <p className="text-muted">{settings.pickup.hours}</p>}
                  <p className="mt-2 text-xs text-muted">We&apos;ll SMS you when your order is ready to collect.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          <Section step={3} title="Payment">
            <div className="grid gap-3">
              {settings.mpesa && (
                <PayOption active={payment === 'mpesa'} onClick={() => setPayment('mpesa')} title="M-Pesa" body="You'll get a prompt on your phone to enter your PIN" badge={<span className="rounded bg-[#4CAF50] px-1.5 py-0.5 text-[0.6rem] font-extrabold text-white">M-PESA</span>} Icon={Smartphone}>
                  <Input id="co-mpesaPhone" label="M-Pesa number to charge" value={mpesaPhone} onChange={setMpesaPhone} type="tel" inputMode="tel" placeholder={phone || '0712 345 678'} hint="Leave blank to use your phone number above" error={fieldErr('mpesaPhone')} />
                </PayOption>
              )}
              {settings.card && <PayOption active={payment === 'card'} onClick={() => setPayment('card')} title="Card" body="Visa or Mastercard via Paystack (secure page)" Icon={CreditCard} />}
              {settings.cod && (
                <PayOption active={payment === 'cod'} disabled={!codAvailable} onClick={() => codAvailable && setPayment('cod')} title="Cash on delivery" body={codAvailable ? 'Pay the rider when your order arrives' : 'Not available for this delivery area'} Icon={Banknote} />
              )}
            </div>
          </Section>

          <AnimatePresence>
            {error && !error.field && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error.message}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="hidden lg:block">
            <PlaceButton pending={pending} total={total} payment={payment} />
            <Legal />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-line bg-white p-6">
            <h2 className="mb-5 font-display text-2xl">Order summary</h2>
            {summary}
          </div>
        </aside>

        {/* Mobile sticky pay bar */}
        <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-paper/95 p-4 pb-safe backdrop-blur lg:hidden">
          <PlaceButton pending={pending} total={total} payment={payment} />
        </div>
      </form>
    </div>
  )
}

function PlaceButton({ pending, total, payment }: { pending: boolean; total: number; payment: string }) {
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
      {pending ? 'Placing your order…' : payment === 'mpesa' ? `Pay ${formatKes(total)} with M-Pesa` : payment === 'card' ? `Pay ${formatKes(total)} by card` : `Place order · ${formatKes(total)}`}
    </button>
  )
}

function Legal() {
  return (
    <p className="mt-3 text-center text-xs text-muted">
      By placing your order you agree to our <Link href="/terms" className="underline">Terms</Link> and{' '}
      <Link href="/delivery-returns" className="underline">Returns policy</Link>.
    </p>
  )
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 font-display text-2xl">
        <span className="grid size-8 place-items-center rounded-full bg-ink font-sans text-sm font-bold text-white">{step}</span> {title}
      </h2>
      {children}
    </section>
  )
}

function Choice({ active, onClick, Icon, title, body }: { active: boolean; onClick: () => void; Icon: typeof Truck; title: string; body: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn('flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition', active ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-stone')}>
      <span className={cn('grid size-10 place-items-center rounded-xl', active ? 'bg-ink text-white' : 'bg-sand')}><Icon className="size-5" /></span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{body}</span>
      </span>
      {active && <Check className="ml-auto size-5" />}
    </button>
  )
}

function PayOption({ active, onClick, title, body, Icon, badge, disabled, children }: { active: boolean; onClick: () => void; title: string; body: string; Icon: typeof Truck; badge?: React.ReactNode; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border bg-white transition', active ? 'border-ink ring-1 ring-ink' : 'border-line', disabled && 'opacity-50')}>
      <button type="button" onClick={onClick} disabled={disabled} role="radio" aria-checked={active} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2', active ? 'border-ink' : 'border-stone')}>{active && <span className="size-2 rounded-full bg-ink" />}</span>
        <Icon className="size-5 shrink-0 text-muted" />
        <span className="flex-1">
          <span className="flex items-center gap-2 text-sm font-bold">{title} {badge}</span>
          <span className="block text-xs text-muted">{body}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {active && children && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Input({ id, label, value, onChange, error, hint, className, ...props }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn('field', error && 'border-danger')} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}
