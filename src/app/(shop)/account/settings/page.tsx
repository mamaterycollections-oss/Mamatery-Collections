import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AccountSettings } from './account-settings'

export default async function AccountSettingsPage() {
  const session = await requireUser('/account/settings')
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('marketing_opt_in').eq('id', session.id).single()
  return (
    <AccountSettings
      profile={{ full_name: session.full_name ?? '', phone: session.phone ?? '', email: session.email ?? '', marketing_opt_in: data?.marketing_opt_in ?? false }}
      isStaff={session.role !== 'customer'}
      mustChangePassword={session.mustChangePassword}
    />
  )
}
