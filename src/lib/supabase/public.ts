import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Cookie-free client for PUBLIC data (anon role, so RLS returns only public rows).
// Pages that fetch only through this client can be pre-rendered and served from
// the CDN instead of being rebuilt on every request.
// It also sends password-reset emails: with the implicit flow the emailed link carries
// the session itself, so it works in whichever browser or phone opens the email.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' },
  })
}
