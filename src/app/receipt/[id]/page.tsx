import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/ui/print-button'
import { loadOrderForViewer } from '@/lib/orders'
import { getSettings } from '@/lib/store'
import { cn, formatDateTime, formatKes, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/utils'

export const metadata: Metadata = { title: 'Receipt', robots: { index: false } }
export const dynamic = 'force-dynamic'

// Printable receipt / invoice. ?format=thermal renders an 80 mm till slip.
export default async function ReceiptPage({ params, searchParams }: PageProps<'/receipt/[id]'>) {
  const { id } = await params
  const sp = await searchParams
  const order = await loadOrderForViewer(id, typeof sp.t === 'string' ? sp.t : null)
  if (!order) notFound()
  const settings = await getSettings()
  const thermal = sp.format === 'thermal'
  const paid = order.payments.filter((p) => p.status === 'paid')

  return (
    <div className={cn('mx-auto bg-white text-ink', thermal ? 'w-[80mm] p-3 font-mono text-[11px]' : 'my-8 max-w-2xl rounded-2xl border border-line p-8 text-sm print:my-0 print:border-0')}>
      <style>{thermal ? '@page { size: 80mm auto; margin: 0 }' : ''}</style>
      <div className={cn('flex items-start justify-between gap-4', thermal && 'flex-col items-center text-center')}>
        <div className={thermal ? 'text-center' : ''}>
          <p className={cn('font-display font-semibold', thermal ? 'text-lg' : 'text-3xl')}>MamaTerry<span className="text-clay">Collections</span></p>
          {settings.pickup_address && <p className="text-muted">{settings.pickup_address}</p>}
          {settings.phone && <p className="text-muted">Tel: {settings.phone}</p>}
          {settings.email && <p className="text-muted">{settings.email}</p>}
        </div>
        <div className={thermal ? 'mt-2' : 'text-right'}>
          <p className="font-bold uppercase">{order.payment_status === 'paid' ? 'Receipt' : 'Invoice'}</p>
          <p>{order.order_number}</p>
          <p className="text-muted">{formatDateTime(order.placed_at)}</p>
        </div>
      </div>

      {!thermal && order.contact_name && (
        <div className="mt-6 rounded-xl bg-paper p-4">
          <p className="text-xs text-muted uppercase">Billed to</p>
          <p className="font-semibold">{order.contact_name}</p>
          {order.contact_phone && <p>{order.contact_phone}</p>}
          {order.delivery_address && <p className="text-muted">{order.delivery_address}{order.delivery_zone_name ? `, ${order.delivery_zone_name}` : ''}</p>}
        </div>
      )}

      <table className={cn('mt-6 w-full', thermal && 'mt-3')}>
        <thead>
          <tr className="border-b border-ink/20 text-left">
            <th className="py-1.5">Item</th>
            <th className="py-1.5 text-right">Qty</th>
            {!thermal && <th className="py-1.5 text-right">Price</th>}
            <th className="py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items.map((it) => (
            <tr key={it.id} className="border-b border-ink/10 align-top">
              <td className="py-1.5 pr-2">
                {it.product_name}
                {it.variant_label && <span className="block text-muted">{it.variant_label}{!thermal && it.sku ? ` · ${it.sku}` : ''}</span>}
              </td>
              <td className="py-1.5 text-right">{it.quantity}</td>
              {!thermal && <td className="py-1.5 text-right tabular-nums">{formatKes(it.unit_price)}</td>}
              <td className="py-1.5 text-right tabular-nums">{formatKes(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={cn('mt-4 ml-auto space-y-1', !thermal && 'w-64')}>
        <Row label="Subtotal" value={formatKes(order.subtotal)} />
        {Number(order.discount_total) > 0 && <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`} value={`−${formatKes(order.discount_total)}`} />}
        {order.channel === 'online' && <Row label="Delivery" value={Number(order.delivery_fee) ? formatKes(order.delivery_fee) : 'Free'} />}
        <div className="flex justify-between border-t border-ink/30 pt-1.5 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatKes(order.total)}</dd></div>
        <Row label="Payment" value={`${PAYMENT_METHOD_LABEL[order.payment_method]} · ${PAYMENT_STATUS_LABEL[order.payment_status]}`} />
        {paid.map((p) => (p.mpesa_receipt || p.reference) && <Row key={p.id} label="Ref" value={p.mpesa_receipt ?? p.reference ?? ''} />)}
        {order.amount_tendered != null && <Row label="Cash received" value={formatKes(order.amount_tendered)} />}
        {order.change_given != null && <Row label="Change" value={formatKes(order.change_given)} />}
      </dl>

      <p className={cn('mt-6 text-center text-muted', thermal && 'mt-4')}>{settings.receipt_footer ?? 'Thank you for shopping with us!'}</p>
      <p className="text-center text-muted">Returns within {settings.return_window_days} days with this receipt.</p>
      <div className="no-print mt-6 flex justify-center">
        <PrintButton />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
