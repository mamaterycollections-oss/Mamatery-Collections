import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, MessageCircle, Phone, Printer, Store } from 'lucide-react'
import { Money, PageHeader, Panel, PaymentBadge, StatusBadge } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { ORDER_DETAIL } from '@/lib/orders'
import { whatsappLink } from '@/lib/store'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/utils'
import { OrderActions } from './order-actions'

export default async function OrderDetailPage({ params }: PageProps<'/dashboard/orders/[id]'>) {
  const { id } = await params
  const { perms } = await requireStaff()
  const supabase = await createClient()
  const { data: order } = await supabase.from('orders').select(ORDER_DETAIL).eq('id', id).maybeSingle()
  if (!order) notFound()

  const people = [...new Set([order.handled_by, order.voided_by, order.discount_by, order.refunded_by, ...order.order_status_history.map((h) => (h as { changed_by?: string | null }).changed_by)].filter(Boolean))] as string[]
  const [{ data: history }, { data: costs }, { data: names }] = await Promise.all([
    supabase.from('order_status_history').select('status, note, created_at, changed_by').eq('order_id', id).order('created_at'),
    perms.margins ? supabase.from('order_item_costs').select('order_item_id, unit_cost').in('order_item_id', order.order_items.map((i) => i.id)) : Promise.resolve({ data: [] }),
    people.length ? supabase.from('profiles').select('id, full_name').in('id', people) : Promise.resolve({ data: [] }),
  ])
  const who = (uid: string | null | undefined) => (uid ? (names ?? []).find((n) => n.id === uid)?.full_name ?? 'Staff' : null)
  const costOf = (itemId: string) => (costs ?? []).find((c) => c.order_item_id === itemId)?.unit_cost
  const totalCost = order.order_items.reduce((s, i) => s + Number(costOf(i.id) ?? 0) * i.quantity, 0)
  const net = Number(order.subtotal) - Number(order.discount_total)
  const wa = whatsappLink(order.contact_phone, `Hi ${order.contact_name?.split(' ')[0] ?? ''}, this is MamaTerryCollections about your order ${order.order_number}.`)

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/orders', label: 'Orders' }}
        title={`Order ${order.order_number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} /> <PaymentBadge status={order.payment_status} />
            <span>· {order.channel === 'in_store' ? 'In-store sale' : 'Online'} · {formatDateTime(order.placed_at)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/receipt/${order.id}`} target="_blank" className="btn btn-light btn-sm"><Printer className="size-4" /> Receipt</Link>
            {order.channel === 'in_store' && <Link href={`/receipt/${order.id}?format=thermal`} target="_blank" className="btn btn-light btn-sm"><Printer className="size-4" /> Till slip</Link>}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {perms.manager && (
            <OrderActions
              order={{
                id: order.id, status: order.status, channel: order.channel, delivery_method: order.delivery_method,
                payment_status: order.payment_status, payment_method: order.payment_method, subtotal: Number(order.subtotal),
                discount_total: Number(order.discount_total), contact_phone: order.contact_phone,
              }}
              discountLimit={perms.discountLimit}
            />
          )}

          <Panel title={`Items (${order.order_items.reduce((s, i) => s + i.quantity, 0)})`} padded={false}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Price</th>{perms.margins && <th className="text-right">Cost</th>}<th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.order_items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-sand">{it.image_url && <Image src={it.image_url} alt="" fill sizes="48px" className="object-cover" />}</div>
                          <div>
                            <p className="font-semibold">{it.product_name}</p>
                            <p className="text-xs text-muted">{it.variant_label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{it.sku}</td>
                      <td className="text-right">{it.quantity}</td>
                      <td className="text-right"><Money value={it.unit_price} /></td>
                      {perms.margins && <td className="text-right text-muted"><Money value={costOf(it.id)} /></td>}
                      <td className="text-right font-semibold"><Money value={it.line_total} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <Row label="Subtotal"><Money value={order.subtotal} /></Row>
              {Number(order.discount_total) > 0 && (
                <Row label={`Discount${order.coupon_code ? ` · ${order.coupon_code}` : ''}${order.discount_reason ? ` · ${order.discount_reason}` : ''}${who(order.discount_by) ? ` (by ${who(order.discount_by)})` : ''}`}>
                  <span className="text-success">−<Money value={order.discount_total} /></span>
                </Row>
              )}
              {order.channel === 'online' && <Row label="Delivery"><Money value={order.delivery_fee} /></Row>}
              <Row label={<b className="text-ink">Total</b>}><b><Money value={order.total} /></b></Row>
              {perms.margins && (
                <Row label="Gross profit (excl. delivery)">
                  <span className="font-semibold text-success"><Money value={net - totalCost} /> {net > 0 && <span className="text-xs text-muted">({(((net - totalCost) / net) * 100).toFixed(1)}%)</span>}</span>
                </Row>
              )}
            </dl>
          </Panel>

          <Panel title="History" padded>
            <ol className="space-y-4">
              {(history ?? []).map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-clay" />
                  <div>
                    <p><b>{ORDER_STATUS_LABEL[h.status]}</b>{who(h.changed_by) ? <span className="text-muted"> · by {who(h.changed_by)}</span> : null}</p>
                    {h.note && <p className="text-muted">{h.note}</p>}
                    <p className="text-xs text-muted">{formatDateTime(h.created_at)}</p>
                  </div>
                </li>
              ))}
              {order.refunded_at && (
                <li className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-danger" />
                  <div>
                    <p><b>Refunded</b> · by {who(order.refunded_by)}</p>
                    <p className="text-muted">{order.refund_reason}</p>
                    <p className="text-xs text-muted">{formatDateTime(order.refunded_at)}</p>
                  </div>
                </li>
              )}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-semibold">{order.contact_name ?? 'Walk-in customer'}</p>
            {order.contact_phone && <p className="text-sm text-muted">{order.contact_phone}</p>}
            {order.contact_email && <p className="text-sm text-muted">{order.contact_email}</p>}
            {order.customer_id && <p className="mt-1 text-xs text-muted">Registered customer</p>}
            {order.contact_phone && (
              <div className="mt-4 flex gap-2">
                <a href={`tel:${order.contact_phone}`} className="btn btn-light btn-sm"><Phone className="size-4" /> Call</a>
                {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-light btn-sm"><MessageCircle className="size-4" /> WhatsApp</a>}
              </div>
            )}
          </Panel>
          {order.channel === 'online' && (
            <Panel title={order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}>
              {order.delivery_method === 'pickup' ? (
                <p className="flex items-center gap-2 text-sm"><Store className="size-4" /> Customer collects from the shop</p>
              ) : (
                <div className="text-sm">
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> <span>{order.delivery_address}<br /><span className="text-muted">{order.delivery_zone_name}</span></span></p>
                  {order.delivery_notes && <p className="mt-2 rounded-lg bg-sand p-2 text-xs">Note: {order.delivery_notes}</p>}
                </div>
              )}
            </Panel>
          )}
          <Panel title="Payments">
            <p className="text-sm">{PAYMENT_METHOD_LABEL[order.payment_method]} · <b>{PAYMENT_STATUS_LABEL[order.payment_status]}</b></p>
            <ul className="mt-3 space-y-2">
              {order.payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-paper p-3 text-xs">
                  <div className="flex justify-between"><span className="font-bold">{PAYMENT_METHOD_LABEL[p.method]} · {PAYMENT_STATUS_LABEL[p.status]}</span><Money value={p.amount} /></div>
                  {(p.mpesa_receipt || p.reference) && <p className="mt-1 font-mono">{p.mpesa_receipt ?? p.reference}</p>}
                  <p className="text-muted">{formatDateTime(p.paid_at ?? p.created_at)}</p>
                </li>
              ))}
              {!order.payments.length && <li className="text-xs text-muted">No payment attempts yet.</li>}
            </ul>
            {order.amount_tendered != null && <p className="mt-3 text-xs text-muted">Cash received <Money value={order.amount_tendered} /> · change <Money value={order.change_given} /></p>}
          </Panel>
          {(order.handled_by || order.void_reason) && (
            <Panel title="Staff">
              {order.handled_by && <p className="text-sm">Handled by <b>{who(order.handled_by)}</b></p>}
              {order.void_reason && <p className="mt-1 text-sm text-danger">Cancelled{who(order.voided_by) ? ` by ${who(order.voided_by)}` : ''}: {order.void_reason}</p>}
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
