import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoPage } from '@/components/shop/info-page'
import { getSettings } from '@/lib/store'

export const metadata: Metadata = { title: 'Terms of sale' }
export const revalidate = 3600

export default async function TermsPage() {
  const s = await getSettings()
  return (
    <InfoPage eyebrow="Legal" title="Terms of sale" updated="30 September 2026" intro="The simple rules for buying from MamaTerryCollections online, in the app or in our shop.">
      <section>
        <h2>Orders & prices</h2>
        <p>All prices are in Kenya Shillings (KES) and include VAT where applicable. The price you pay is the one shown at checkout. Your order is confirmed once payment is received (or, for cash on delivery, once we confirm it by phone or SMS). If an item becomes unavailable we’ll let you know and refund you in full.</p>
      </section>
      <section>
        <h2>Payment</h2>
        <p>We accept M-Pesa, and — where shown — cards via Paystack and cash on delivery in selected areas. Unpaid M-Pesa or card orders are cancelled automatically after 45 minutes so items go back on sale.</p>
      </section>
      <section>
        <h2>Delivery</h2>
        <p>Delivery fees and estimated times depend on your delivery area and are shown before you pay. Please give an accurate address and a phone number the rider can reach. See <Link href="/delivery-returns">Delivery & returns</Link>.</p>
      </section>
      <section>
        <h2>Returns & refunds</h2>
        <p>You may return unworn items with tags attached within {s.return_window_days} days of delivery. Refunds go back to your original payment method (M-Pesa refunds to the paying number). Items marked final sale, underwear and earrings can’t be returned for hygiene reasons unless faulty.</p>
      </section>
      <section>
        <h2>Discount codes</h2>
        <p>One code per order, subject to any minimum spend or expiry shown. Codes have no cash value.</p>
      </section>
      <section>
        <h2>Reviews</h2>
        <p>Reviews must be honest and about the product. We may decline reviews that are abusive, off-topic or contain personal information.</p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>Keep your password private. You can delete your account at any time from your account settings.</p>
      </section>
      <section>
        <h2>Liability & law</h2>
        <p>Nothing in these terms limits your rights under the Consumer Protection Act, 2012. These terms are governed by the laws of Kenya.</p>
      </section>
    </InfoPage>
  )
}
