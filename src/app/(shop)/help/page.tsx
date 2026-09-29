import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoPage } from '@/components/shop/info-page'

export const metadata: Metadata = { title: 'Help & FAQs' }

const FAQS: [string, React.ReactNode][] = [
  ['How do I pay with M-Pesa?', 'Choose M-Pesa at checkout and enter your Safaricom number. A payment prompt appears on your phone — enter your M-Pesa PIN and your order is confirmed automatically. No need to copy paybill numbers.'],
  ['I didn’t get the M-Pesa prompt', 'Make sure your phone is on and unlocked, then tap “Send M-Pesa prompt” again on your order page. Your items are reserved for 45 minutes.'],
  ['Do I need an account?', 'No — you can check out as a guest. An account lets you track all your orders, save addresses and keep a wishlist across devices.'],
  ['How do I choose my size?', 'Open the Size guide on any clothing page. Between sizes? Size up for a relaxed fit, or ask us on WhatsApp.'],
  ['How long does delivery take?', <>It depends on your area — usually 1–2 days in and around Nairobi and 2–4 days countrywide. See <Link href="/delivery-returns">Delivery & returns</Link>.</>],
  ['Can I cancel my order?', 'Yes, from your order page while it’s still unpaid. Once paid or confirmed, contact us and we’ll help.'],
  ['How do returns work?', <>Unworn items with tags can be returned. Full details on <Link href="/delivery-returns">Delivery & returns</Link>.</>],
  ['Is there an app?', 'Yes — install MamaTerry from Google Play, or tap “Add to Home screen” in your browser menu for the same experience.'],
]

export default function HelpPage() {
  return (
    <InfoPage eyebrow="Help" title="Questions, answered" intro={<>Can’t find what you need? <Link href="/contact" className="font-semibold text-ink underline">Contact us</Link> — we reply fast.</>}>
      <div className="divide-y divide-line rounded-3xl border border-line bg-white">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
              {q}
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sand transition group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-muted">{a}</div>
          </details>
        ))}
      </div>
    </InfoPage>
  )
}
