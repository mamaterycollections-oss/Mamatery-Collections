import { NextResponse, type NextRequest } from 'next/server'
import { verifyOrderToken } from '@/lib/orders'
import { refreshMpesaStatus } from '@/lib/payments'

// Polled by the "check your phone" screen while an M-Pesa prompt is pending.
export async function GET(request: NextRequest, ctx: RouteContext<'/api/orders/[id]/status'>) {
  const { id } = await ctx.params
  const token = request.nextUrl.searchParams.get('t')
  let order = await verifyOrderToken(id, token)
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (order.payment_method === 'mpesa' && order.payment_status !== 'paid') {
    await refreshMpesaStatus(id).catch((e) => console.error('mpesa refresh', e))
    order = (await verifyOrderToken(id, token)) ?? order
  }
  return NextResponse.json({ status: order.status, payment_status: order.payment_status }, { headers: { 'Cache-Control': 'no-store' } })
}
