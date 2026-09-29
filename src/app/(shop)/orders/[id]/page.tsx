import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Printer, Store } from 'lucide-react'
import { OrderTimeline } from '@/components/shop/order-timeline'
import { loadOrderForViewer } from '@/lib/orders'
import { getSettings, whatsappLink } from '@/lib/store'
import { formatDateTime, formatKes, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/utils'
import { CancelOrder, PaymentPanel, PaymentSuccess } from './payment-panel'

export const metadata: Metadata = { title: 'Your order', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function OrderPage({ params, searchParams }: PageProps<'/orders/[id]'>) {
  const { id } = await params
  const sp = await searchParams
  const token = typeof sp.t === 'string' ? sp.t : null
  const order = await loadOrderForViewer(id, token)
  if (!order) notFound()
  const settings = await getSettings()
  const isNew = sp.new === '1'
  const awaitingPayment = ['mpesa', 'card'].includes(order.payment_method) && order.payment_status !== 'paid' && order.status !== 'cancelled'
  const wa = whatsappLink(settings.whatsapp ?? settings.phone, `Hi! About my order ${order.order_number}`)
  const history = [...order.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div className="container-page max-w-5xl pt-8 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Order {order.order_number}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">
            {order.status === 'cancelled' ? 'Order cancelled' : awaitingPayment ? 'Almost there…' : isNew ? 'Thank you!' : ORDER_STATUS_LABEL[order.status]}
          </h1>
          <p className="mt-2 text-muted">Placed {formatDateTime(order.placed_at)}{order.contact_name ? ` · ${order.contact_name}` : ''}</p>
        </div>
        <Link href={`/receipt/${order.id}?t=${order.tracking_token}`} target="_blank" className="btn btn-light btn-sm no-print">
          <Printer className="size-4" /> Receipt
        </Link>
      </div>

      {awaitingPayment && (
        <PaymentPanel
          orderId={order.id}
          token={order.tracking_token}
          method={order.payment_method as 'mpesa' | 'card'}
          total={Number(order.total)}
          phone={order.contact_phone ?? ''}
          email={order.contact_email ?? ''}
          initialError={typeof sp.perr === 'string' ? sp.perr : null}
          paymentStatus={order.payment_status}
        />
      )}
      {!awaitingPayment && isNew && order.status !== 'cancelled' && <PaymentSuccess orderNumber={order.order_number} cod={order.payment_method === 'cod'} />}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          {order.status !== 'cancelled' && order.channel === 'online' && (
            <section className="rounded-3xl border border-line bg-white p-6">
              <h2 className="font-display text-2xl">Progress</h2>
              <OrderTimeline status={order.status} method={order.delivery_method} history={history} />
            </section>
          )}
          {order.status === 'cancelled' && (
            <div className="rounded-3xl bg-danger-soft p-6 text-sm text-danger">
              <p className="font-bold">This order was cancelled.</p>
              {order.void_reason && <p className="mt-1">Reason: {order.void_reason}</p>}
              {order.payment_status === 'paid' && <p className="mt-1">Your refund is being processed — we&apos;ll contact you shortly.</p>}
            </div>
          )}

          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-2xl">Items</h2>
            <ul className="mt-4 divide-y divide-line">
              {order.order_items.map((it) => (
                <li key={it.id} className="flex gap-4 py-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {it.image_url && <Image src={it.image_url} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{it.product_name}</p>
                    {it.variant_label && <p className="text-sm text-muted">{it.variant_label}</p>}
                    <p className="mt-1 text-sm text-muted">Qty {it.quantity} × {formatKes(it.unit_price)}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatKes(it.line_total)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-line bg-white p-6">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatKes(order.subtotal)}</dd></div>
              {Number(order.discount_total) > 0 && <div className="flex justify-between text-success"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd className="tabular-nums">−{formatKes(order.discount_total)}</dd></div>}
              {order.channel === 'online' && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tabular-nums">{Number(order.delivery_fee) ? formatKes(order.delivery_fee) : 'Free'}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatKes(order.total)}</dd></div>
            </dl>
            <p className="mt-4 flex items-center justify-between rounded-xl bg-sand px-3 py-2 text-xs">
              <span>{PAYMENT_METHOD_LABEL[order.payment_method]}</span>
              <span className={order.payment_status === 'paid' ? 'font-bold text-success' : 'font-bold text-warning'}>{PAYMENT_STATUS_LABEL[order.payment_status]}</span>
            </p>
            {order.payments.filter((p) => p.status === 'paid' && p.mpesa_receipt).map((p) => (
              <p key={p.id} className="mt-2 text-xs text-muted">M-Pesa ref: <span className="font-mono">{p.mpesa_receipt}</span></p>
            ))}
          </div>

          {order.channel === 'online' && (
            <div className="rounded-3xl border border-line bg-white p-6 text-sm">
              {order.delivery_method === 'courier' ? (
                <>
                  <p className="flex items-center gap-2 font-bold"><MapPin className="size-4" /> Delivery to</p>
                  <p className="mt-2">{order.contact_name}</p>
                  <p className="text-muted">{order.delivery_address}</p>
                  {order.delivery_notes && <p className="text-muted">{order.delivery_notes}</p>}
                  <p className="mt-1 text-muted">{order.delivery_zone_name}</p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2 font-bold"><Store className="size-4" /> Pickup</p>
                  <p className="mt-2 text-muted">{settings.pickup_address}</p>
                  {settings.pickup_hours && <p className="text-muted">{settings.pickup_hours}</p>}
                </>
              )}
              <p className="mt-3 text-muted">{order.contact_phone}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-light">Questions? Chat with us</a>}
            {order.status === 'placed' && order.payment_status !== 'paid' && order.customer_id && <CancelOrder orderId={order.id} />}
            <Link href="/shop" className="btn btn-ghost">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
