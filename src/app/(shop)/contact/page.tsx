import type { Metadata } from 'next'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { InfoPage } from '@/components/shop/info-page'
import { getSettings, whatsappLink } from '@/lib/store'

export const metadata: Metadata = { title: 'Contact us' }
export const revalidate = 300

export default async function ContactPage() {
  const s = await getSettings()
  const wa = whatsappLink(s.whatsapp ?? s.phone, 'Hi MamaTerryCollections!')
  const items = [
    wa && { Icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us', href: wa },
    s.phone && { Icon: Phone, label: 'Call', value: s.phone, href: `tel:${s.phone}` },
    s.email && { Icon: Mail, label: 'Email', value: s.email, href: `mailto:${s.email}` },
    s.pickup_address && { Icon: MapPin, label: 'Visit', value: s.pickup_address, href: null },
    s.pickup_hours && { Icon: Clock, label: 'Hours', value: s.pickup_hours, href: null },
  ].filter(Boolean) as { Icon: typeof Phone; label: string; value: string; href: string | null }[]
  return (
    <InfoPage eyebrow="We’re here to help" title="Contact us" intro="Questions about sizes, an order or a return? Reach us any of these ways.">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ Icon, label, value, href }) => {
          const body = (
            <div className="flex h-full items-start gap-4 rounded-2xl border border-line bg-white p-5 transition hover:shadow-soft">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-clay-soft text-clay"><Icon className="size-5" /></span>
              <span><span className="block text-xs font-bold tracking-wide text-muted uppercase">{label}</span><span className="font-semibold">{value}</span></span>
            </div>
          )
          return href ? <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="no-underline">{body}</a> : <div key={label}>{body}</div>
        })}
        {!items.length && <p className="text-muted">Contact details are coming soon.</p>}
      </div>
    </InfoPage>
  )
}
