import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoPage } from '@/components/shop/info-page'

export const metadata: Metadata = { title: 'About us' }

export default function AboutPage() {
  return (
    <InfoPage eyebrow="Our story" title="Style that speaks for you" intro="MamaTerryCollections brings together clothes, bags, caps and accessories picked for real life in Kenya — pieces that look good, feel good and don’t cost the earth.">
      <section>
        <h2>What we do</h2>
        <p>Every piece is hand-picked. We check quality, fit and finish before anything goes on sale, and we restock the favourites you keep asking for.</p>
        <p>Shop online and pay in seconds with M-Pesa, or visit us in person — the same prices, the same stock, the same friendly help.</p>
      </section>
      <section>
        <h2>Our promise</h2>
        <ul>
          <li>Honest photos and descriptions</li>
          <li>Secure M-Pesa checkout — we never see your PIN</li>
          <li>Delivery updates by SMS at every step</li>
          <li>Easy returns on unworn items</li>
        </ul>
      </section>
      <p><Link href="/shop" className="btn btn-primary no-underline">Shop the collection</Link></p>
    </InfoPage>
  )
}
