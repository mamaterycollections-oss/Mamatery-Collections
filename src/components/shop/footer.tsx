import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { NewsletterForm } from '@/components/shop/newsletter-form'
import type { Category, Settings } from '@/lib/store'
import { whatsappLink } from '@/lib/store'

const Instagram = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
)
const Facebook = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.2L14 2c-3.3 0-4 2.4-4 4v2.5H7.5V12H10v10h4V12h2.8l.4-3.5H14Z" /></svg>
)
const TikTok = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.1-2.8V9a6.3 6.3 0 1 0 5.4 6.2V8.6a8 8 0 0 0 4.6 1.4V6.7a4.6 4.6 0 0 1-4.6-4.7Z" /></svg>
)
const WhatsApp = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-1.6-.5-3.6-1.7-5-3.6-1-1.3-1.4-2.4-1.5-3.1-.2-1.4.7-2.2 1-2.5.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.6Z" /></svg>
)

export function Footer({ settings, categories }: { settings: Settings; categories: Category[] }) {
  const wa = whatsappLink(settings.whatsapp ?? settings.phone, 'Hi MamaTerryCollections!')
  const socials = [
    { href: settings.instagram_url, label: 'Instagram', Icon: Instagram },
    { href: settings.tiktok_url, label: 'TikTok', Icon: TikTok },
    { href: settings.facebook_url, label: 'Facebook', Icon: Facebook },
    { href: wa, label: 'WhatsApp', Icon: WhatsApp },
  ].filter((s) => s.href)

  return (
    <footer className="mt-24 bg-ink pb-24 text-paper/80 lg:pb-0">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
        <div>
          <Logo light className="items-start" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">
            {(settings.tagline ?? 'Clothes, bags & caps that speak for you').replace(/[.!]?$/, '.')} Shop online, pay with M-Pesa and get it delivered anywhere in Kenya.
          </p>
          {socials.length > 0 && (
            <div className="mt-6 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full border border-paper/15 transition hover:border-gold hover:text-gold">
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow text-paper/50">Shop</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/shop?sort=new" className="hover:text-white">New arrivals</Link></li>
            {categories.map((c) => (
              <li key={c.id}><Link href={`/shop/${c.slug}`} className="hover:text-white">{c.name}</Link></li>
            ))}
            <li><Link href="/shop?sale=1" className="hover:text-white">On sale</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-paper/50">Help</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/track" className="hover:text-white">Track your order</Link></li>
            <li><Link href="/delivery-returns" className="hover:text-white">Delivery &amp; returns</Link></li>
            <li><Link href="/help" className="hover:text-white">FAQs</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact us</Link></li>
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-paper/50">Be the first to know</p>
          <p className="mt-4 text-sm text-paper/60">New drops, restocks and members-only offers. No spam.</p>
          <NewsletterForm />
          <ul className="mt-6 space-y-2 text-sm text-paper/60">
            {settings.phone && (
              <li className="flex items-center gap-2"><Phone className="size-4" /> <a href={`tel:${settings.phone}`} className="hover:text-white">{settings.phone}</a></li>
            )}
            {settings.email && (
              <li className="flex items-center gap-2"><Mail className="size-4" /> <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a></li>
            )}
            {settings.pickup_enabled && settings.pickup_address && (
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> {settings.pickup_address}</li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-6 text-xs text-paper/45 sm:flex-row">
          <p>© {new Date().getFullYear()} MamaTerryCollections. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/delete-account" className="hover:text-white">Delete account</Link>
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-[#4CAF50] px-1.5 py-0.5 text-[0.6rem] font-extrabold tracking-wide text-white">M-PESA</span>
              <span className="rounded bg-paper/90 px-1.5 py-0.5 text-[0.6rem] font-extrabold text-[#1a1f71]">VISA</span>
              <span className="rounded bg-paper/90 px-1.5 py-0.5 text-[0.6rem] font-extrabold text-[#eb001b]">MC</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
