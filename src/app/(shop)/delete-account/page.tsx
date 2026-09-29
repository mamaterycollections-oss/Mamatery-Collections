import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { InfoPage } from '@/components/shop/info-page'
import { getSettings } from '@/lib/store'

export const metadata: Metadata = { title: 'Delete your account', description: 'How to delete your MamaTerryCollections account and data.' }

// Public page linked from Google Play's "Data deletion" field.
export default async function DeleteAccountPage({ searchParams }: PageProps<'/delete-account'>) {
  const sp = await searchParams
  const s = await getSettings()
  if (sp.done === '1') {
    return (
      <div className="container-page grid min-h-[60dvh] place-items-center text-center">
        <div>
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="mt-4 font-display text-4xl">Your account has been deleted</h1>
          <p className="mt-3 text-muted">We’ve removed your personal data. Thank you for shopping with us.</p>
          <Link href="/" className="btn btn-primary mt-8">Back to the shop</Link>
        </div>
      </div>
    )
  }
  return (
    <InfoPage eyebrow="MamaTerryCollections app & website" title="Delete your account" intro="You can delete your account and personal data at any time — in the app or on the website.">
      <section>
        <h2>Delete it yourself (fastest)</h2>
        <ul>
          <li>Open the MamaTerry app or this website and <Link href="/login?next=/account/settings">sign in</Link>.</li>
          <li>Go to <b>Account → Settings</b>.</li>
          <li>Tap <b>Delete my account</b>, type DELETE and confirm.</li>
        </ul>
        <p>Deletion happens immediately.</p>
      </section>
      <section>
        <h2>Can’t sign in?</h2>
        <p>Send a deletion request from the email or phone number on your account to {s.email ?? 'the email on our Contact page'}{s.phone ? ` or ${s.phone}` : ''}. We’ll confirm it’s you and delete the account within 7 days.</p>
      </section>
      <section>
        <h2>What gets deleted</h2>
        <ul>
          <li>Your login, name, phone number and email</li>
          <li>Saved addresses, wishlist, bag and reviews</li>
          <li>Notification settings on your devices</li>
        </ul>
        <h2 className="mt-6">What we keep</h2>
        <p>Records of past orders and payments are kept for 7 years because Kenyan tax law requires it — but with your name, phone, email and address removed, so they can no longer be linked to you.</p>
      </section>
    </InfoPage>
  )
}
