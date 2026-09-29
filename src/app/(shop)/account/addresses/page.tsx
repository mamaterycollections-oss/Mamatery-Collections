import { requireUser } from '@/lib/auth'
import { getZones } from '@/lib/store'
import { createClient } from '@/lib/supabase/server'
import { AddressBook } from './address-book'

export default async function AddressesPage() {
  const session = await requireUser('/account/addresses')
  const supabase = await createClient()
  const [{ data }, zones] = await Promise.all([
    supabase.from('customer_addresses').select('*').eq('user_id', session.id).order('is_default', { ascending: false }).order('created_at'),
    getZones(),
  ])
  return <AddressBook addresses={data ?? []} zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
}
