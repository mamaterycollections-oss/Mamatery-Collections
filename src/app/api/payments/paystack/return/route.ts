import { NextResponse, type NextRequest } from 'next/server'
import { settleCard } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'

// Customer is redirected here after the Paystack page. We verify with Paystack
// (never trust the redirect) and send them to their order.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference') ?? request.nextUrl.searchParams.get('trxref')
  const home = new URL('/', request.url)
  if (!reference) return NextResponse.redirect(home)
  const result = await settleCard(reference).catch(() => ({ ok: false as const, orderId: null }))
  if (!result.orderId) return NextResponse.redirect(home)
  const { data } = await createAdminClient().from('orders').select('tracking_token').eq('id', result.orderId).single()
  const url = new URL(`/orders/${result.orderId}`, request.url)
  url.searchParams.set('t', data?.tracking_token ?? '')
  url.searchParams.set('new', '1')
  if (!result.ok) url.searchParams.set('perr', 'Your card payment didn’t complete. You can try again below.')
  return NextResponse.redirect(url)
}
