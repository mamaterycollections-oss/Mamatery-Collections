import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoPage } from '@/components/shop/info-page'
import { getSettings } from '@/lib/store'

export const metadata: Metadata = { title: 'Privacy policy', description: 'How MamaTerryCollections collects, uses and protects your personal data.' }
export const revalidate = 3600

export default async function PrivacyPage() {
  const s = await getSettings()
  const contact = s.email ?? 'our contact email on the Contact page'
  return (
    <InfoPage eyebrow="Legal" title="Privacy policy" updated="30 September 2026" intro="We collect only what we need to sell you clothes, deliver them and keep your account safe. We never sell your data.">
      <section>
        <h2>Who we are</h2>
        <p>MamaTerryCollections (“we”, “us”) runs this website and the MamaTerry mobile app. We are the data controller for the personal data described here, processed under Kenya’s Data Protection Act, 2019.</p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Contact details</b> — name, phone number and email you give at checkout or sign-up.</li>
          <li><b>Delivery details</b> — delivery area, address and landmarks you type in.</li>
          <li><b>Orders and payments</b> — what you bought, amounts, and payment references (e.g. M-Pesa confirmation codes). We never see or store your M-Pesa PIN or full card number; card payments are handled by Paystack.</li>
          <li><b>Account data</b> — your login email and an encrypted password (handled by our hosting provider Supabase), saved addresses, wishlist and reviews.</li>
          <li><b>Device data</b> — a notification token if you turn on notifications, and basic technical logs (IP address, browser type) used for security and fraud prevention.</li>
        </ul>
        <p>We do not use advertising trackers, and the app does not access your location, contacts or photos. Staff devices may use the camera only to scan product barcodes in our shop.</p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To process, deliver and support your orders (performance of a contract).</li>
          <li>To send order updates by SMS, email or push notification.</li>
          <li>To keep records required for tax and accounting (legal obligation).</li>
          <li>To prevent fraud and keep the service secure (legitimate interest).</li>
          <li>To send offers and new-arrival news — only if you opted in. You can opt out any time in your account settings.</li>
        </ul>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <p>Only service providers who help us run the shop, under agreements to protect it: Safaricom (M-Pesa payments), Paystack (card payments), Supabase (secure database hosting), Vercel (website hosting), Africa’s Talking (SMS), Resend (email), and the courier or rider delivering your order (name, phone and address only). Some providers store data outside Kenya with appropriate safeguards.</p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>Account data is kept until you delete your account. Order and payment records are kept for 7 years to meet Kenyan tax requirements, but are anonymised if you delete your account.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>You can access, correct, download or delete your data. Signed-in customers can do this themselves: <Link href="/account/settings">Account → Settings</Link> (“Download my data” and “Delete account”). You can also read <Link href="/delete-account">how to delete your account</Link>, or write to us at {contact}. You may complain to the Office of the Data Protection Commissioner (ODPC) of Kenya.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Data is encrypted in transit (HTTPS) and access is restricted by role — for example, shop attendants cannot see customers’ full order history or our costs. Payments are processed by licensed providers.</p>
      </section>
      <section>
        <h2>Children</h2>
        <p>Our shop is not directed at children under 13, and we do not knowingly collect their data.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>We’ll post any changes on this page and update the date above. Questions? <Link href="/contact">Contact us</Link>.</p>
      </section>
    </InfoPage>
  )
}
