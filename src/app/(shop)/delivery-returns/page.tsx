import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoPage } from '@/components/shop/info-page'
import { getSettings, getZones } from '@/lib/store'
import { formatKes } from '@/lib/utils'

export const metadata: Metadata = { title: 'Delivery & returns' }
export const revalidate = 300

export default async function DeliveryPage() {
  const [s, zones] = await Promise.all([getSettings(), getZones()])
  return (
    <InfoPage eyebrow="Help" title="Delivery & returns" intro="Fast delivery across Kenya, with SMS updates at every step.">
      <section>
        <h2>Delivery areas & fees</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          <table className="table">
            <thead><tr><th>Area</th><th>Time</th><th className="text-right">Fee</th></tr></thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}><td><b>{z.name}</b>{z.description && <p className="text-xs text-muted">{z.description}</p>}</td><td>{z.eta}</td><td className="text-right">{formatKes(z.fee)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.free_delivery_threshold != null && <p className="mt-3">Free delivery on orders over <b>{formatKes(s.free_delivery_threshold)}</b>.</p>}
        {s.pickup_enabled && s.pickup_address && <p className="mt-3">Prefer to collect? Choose <b>Pick up</b> at checkout — it’s free. {s.pickup_address}{s.pickup_hours ? ` · ${s.pickup_hours}` : ''}.</p>}
        {s.cod_enabled && <p className="mt-3">Cash on delivery is available in selected areas — you’ll see it at checkout where it applies.</p>}
      </section>
      <section>
        <h2>Tracking</h2>
        <p>We SMS you when your order is confirmed, packed and on its way. You can check progress any time on <Link href="/track">Track your order</Link> or in your account.</p>
      </section>
      <section>
        <h2>Returns</h2>
        <ul>
          <li>Return unworn items with tags within <b>{s.return_window_days} days</b> of delivery.</li>
          <li>Message us first (WhatsApp or phone) with your order number so we can arrange the return.</li>
          <li>Refunds go to your original payment method once we receive the item — M-Pesa refunds are sent to the paying number.</li>
          <li>Faulty or wrong item? We cover the return delivery.</li>
        </ul>
      </section>
    </InfoPage>
  )
}
