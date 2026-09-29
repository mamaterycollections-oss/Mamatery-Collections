import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only routes that read the session on the server. Storefront pages check
  // sign-in in the browser so they can be cached on the CDN.
  matcher: ['/dashboard/:path*', '/account/:path*', '/checkout', '/login', '/signup', '/reset-password'],
}
