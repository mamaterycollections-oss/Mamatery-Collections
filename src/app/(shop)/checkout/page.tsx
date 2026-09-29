import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { getSettings, getZones } from '@/lib/store'
import { createClient } from '@/lib/supabase/server'
import { paystackEnabled } from '@/lib/payments'
import { CheckoutForm } from './checkout-form'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }

export default async function CheckoutPage() {
  const [settings, zones, session] = await Promise.all([getSettings(), getZones(), getSession()])
  let addresses: { id: string; recipient_name: string; phone: string; zone_id: string | null; address_line: string; landmark: string | null; is_default: boolean }[] = []
  if (session) {
    const supabase = await createClient()
    const { data } = await supabase.from('customer_addresses').select('id, recipient_name, phone, zone_id, address_line, landmark, is_default').eq('user_id', session.id).order('is_default', { ascending: false })
    addresses = data ?? []
  }
  return (
    <CheckoutForm
      zones={zones.map((z) => ({ id: z.id, name: z.name, description: z.description, fee: Number(z.fee), eta: z.eta, cod: z.cod_allowed }))}
      settings={{
        pickup: settings.pickup_enabled ? { address: settings.pickup_address, hours: settings.pickup_hours } : null,
        mpesa: settings.mpesa_enabled,
        card: settings.card_enabled && paystackEnabled(),
        cod: settings.cod_enabled,
        freeOver: settings.free_delivery_threshold != null ? Number(settings.free_delivery_threshold) : null,
      }}
      user={session ? { name: session.full_name ?? '', phone: session.phone ?? '', email: session.email ?? '', signedIn: true } : null}
      addresses={addresses}
    />
  )
}
